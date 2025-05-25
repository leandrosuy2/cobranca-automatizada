import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcela } from '../entities/parcela.entity';
import { ControleEmails } from '../entities/controle-emails.entity';
import { WhatsAppService } from './whatsapp.service';
import { MercadoPagoService } from './mercadopago.service';
import axios from 'axios';
import * as qrcode from 'qrcode';
import { Between } from 'typeorm';

@Injectable()
export class ParcelService {
  private readonly logger = new Logger(ParcelService.name);

  constructor(
    @InjectRepository(Parcela)
    private parcelRepository: Repository<Parcela>,
    @InjectRepository(ControleEmails)
    private controleEmailsRepository: Repository<ControleEmails>,
    private whatsappService: WhatsAppService,
    private mercadoPagoService: MercadoPagoService,
  ) {}

  async checkAndProcessParcels(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Primeiro, verifica todas as parcelas com payment_id
      const parcelsWithPayment = await this.parcelRepository
        .createQueryBuilder('parcela')
        .leftJoinAndSelect('parcela.contrato', 'contrato')
        .leftJoinAndSelect('contrato.cliente', 'cliente')
        .where('parcela.payment_id IS NOT NULL')
        .andWhere('parcela.status = :status', { status: 'pendente' })
        .getMany();

      // Verifica o status de pagamento de cada parcela
      for (const parcel of parcelsWithPayment) {
        const isPaid = await this.mercadoPagoService.checkPaymentStatus(parcel.payment_id);
        if (isPaid) {
          this.logger.debug(`Parcela ${parcel.id} já foi paga. Atualizando status...`);
          await this.updateParcelStatus(parcel);
        }
      }

      // Get parcels due today
      const parcelsDueToday = await this.parcelRepository
        .createQueryBuilder('parcela')
        .leftJoinAndSelect('parcela.contrato', 'contrato')
        .leftJoinAndSelect('contrato.cliente', 'cliente')
        .where('parcela.data_vencimento = :today', { today })
        .andWhere('parcela.status = :status', { status: 'pendente' })
        .getMany();

      // Get overdue parcels
      const overdueParcels = await this.parcelRepository
        .createQueryBuilder('parcela')
        .leftJoinAndSelect('parcela.contrato', 'contrato')
        .leftJoinAndSelect('contrato.cliente', 'cliente')
        .where('parcela.data_vencimento < :today', { today })
        .andWhere('parcela.status = :status', { status: 'pendente' })
        .getMany();

      // Process parcels due today
      for (const parcel of parcelsDueToday) {
        await this.processParcel(parcel, false);
      }

      // Process overdue parcels
      for (const parcel of overdueParcels) {
        await this.processParcel(parcel, true);
      }
    } catch (error) {
      // Safely stringify error object without circular references
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error.response ? {
        status: error.response.status,
        data: error.response.data
      } : {};
      
      this.logger.error(`Error checking and processing parcels: ${errorMessage}`, errorDetails);
    }
  }

  private async processParcel(parcel: Parcela, isOverdue: boolean): Promise<void> {
    try {
      // Se já existe payment_id, verifica o status do pagamento
      if (parcel.payment_id) {
        this.logger.debug(`Verificando status do pagamento existente para parcela ${parcel.id}`);
        const isPaid = await this.mercadoPagoService.checkPaymentStatus(parcel.payment_id);
        
        if (isPaid) {
          this.logger.debug(`Parcela ${parcel.id} já foi paga. Atualizando status...`);
          await this.updateParcelStatus(parcel);
          return;
        }
        
        this.logger.debug(`Parcela ${parcel.id} ainda não foi paga. Verificando se já enviamos mensagem hoje...`);
      }

      // Verifica se já foi enviada mensagem hoje para este cliente
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const messageSent = await this.controleEmailsRepository.findOne({
        where: {
          cliente_id: parcel.contrato.cliente.id,
          data_envio: Between(today, tomorrow)
        }
      });

      if (messageSent) {
        this.logger.debug(`Mensagem já enviada hoje para o cliente ${parcel.contrato.cliente.id}`);
        return;
      }

      // Inicia uma transação para garantir atomicidade
      const queryRunner = this.controleEmailsRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Verifica novamente dentro da transação
        const messageSentInTransaction = await queryRunner.manager.findOne(ControleEmails, {
          where: {
            cliente_id: parcel.contrato.cliente.id,
            data_envio: Between(today, tomorrow)
          }
        });

        if (messageSentInTransaction) {
          this.logger.debug(`Mensagem já enviada hoje para o cliente ${parcel.contrato.cliente.id} (verificação em transação)`);
          await queryRunner.rollbackTransaction();
          return;
        }

        let pixData;
        // Se já tem payment_id, usa os dados existentes
        if (parcel.payment_id) {
          this.logger.debug(`Parcela ${parcel.id} já tem payment_id ${parcel.payment_id}. Reenviando mensagem.`);
          // Busca os dados do pagamento no Mercado Pago
          const paymentResponse = await axios.get(
            `${this.mercadoPagoService['apiUrl']}/v1/payments/${parcel.payment_id}`,
            {
              headers: {
                'Authorization': `Bearer ${this.mercadoPagoService['accessToken']}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const payment = paymentResponse.data;
          const transactionData = payment.point_of_interaction?.transaction_data;
          
          if (!transactionData?.qr_code) {
            this.logger.error('QR code não encontrado na resposta do Mercado Pago');
            return;
          }

          // Gera a imagem do QR code
          const qrCodeImage = await qrcode.toDataURL(transactionData.qr_code);

          pixData = {
            qr_code: transactionData.qr_code,
            qr_code_image: qrCodeImage,
            payment_id: parcel.payment_id,
            pix_code: transactionData.qr_code
          };
        } else {
          // Generate new PIX QR code
          const descricao = `Parcela ${parcel.numero_parcela} - Contrato ${parcel.contrato_id}${isOverdue ? ' (ATRASADA)' : ''}`;
          const referencia = `CONTRATO_${parcel.contrato_id}_PARCELA_${parcel.numero_parcela}${isOverdue ? '_ATRASADA' : ''}`;
          
          // Garante que o valor seja um número
          const valor = Number(parcel.valor);
          
          pixData = await this.mercadoPagoService.generatePixQRCode(
            valor,
            descricao,
            referencia,
            {
              nome: parcel.contrato.cliente.nome,
              email: parcel.contrato.cliente.email,
              cpf: parcel.contrato.cliente.cpf,
              telefone: parcel.contrato.cliente.whatsapp
            }
          );

          if (pixData) {
            // Update payment_id in parcel
            parcel.payment_id = pixData.payment_id;
            await this.parcelRepository.save(parcel);
          }
        }

        if (pixData) {
          // Prepare messages
          const messages = this.prepareMessage(parcel, pixData);

          // Send WhatsApp messages
          const sentDetails = await this.whatsappService.sendMessage(
            parcel.contrato.cliente.whatsapp,
            messages.details
          );

          if (sentDetails) {
            // Wait 1 second before sending the PIX code
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const sentPixCode = await this.whatsappService.sendMessage(
              parcel.contrato.cliente.whatsapp,
              messages.pixCode
            );

            if (sentPixCode) {
              try {
                // Cria um novo registro de controle de emails dentro da transação
                const controleEmail = new ControleEmails();
                controleEmail.cliente_id = parcel.contrato.cliente.id;
                controleEmail.data_envio = new Date();
                
                // Salva o registro dentro da transação
                await queryRunner.manager.save(controleEmail);
                
                // Commit da transação
                await queryRunner.commitTransaction();
                
                this.logger.debug(`Registro de envio salvo para o cliente ${parcel.contrato.cliente.id}`);

                // Check payment status after 30 seconds
                setTimeout(async () => {
                  const isPaid = await this.mercadoPagoService.checkPaymentStatus(pixData.payment_id);
                  if (isPaid) {
                    await this.updateParcelStatus(parcel);
                  }
                }, 30000);
              } catch (error) {
                await queryRunner.rollbackTransaction();
                this.logger.error(`Erro ao salvar registro de envio: ${error.message}`);
              }
            } else {
              await queryRunner.rollbackTransaction();
            }
          } else {
            await queryRunner.rollbackTransaction();
          }
        }
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      // Safely stringify error object without circular references
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error.response ? {
        status: error.response.status,
        data: error.response.data
      } : {};
      
      this.logger.error(`Erro ao processar parcela: ${errorMessage}`, errorDetails);
    }
  }

  private prepareMessage(parcel: Parcela, pixData: any): { details: string; pixCode: string } {
    const valor = Number(parcel.valor);
    
    let details = `Olá ${parcel.contrato.cliente.nome}\n`;
    details += `a parcela ${parcel.numero_parcela} do seu contrato encontra em aberto\n`;
    details += `Valor Original: R$ ${valor.toFixed(2)}\n\n`;
    
    details += `Para evita acúmulo de juros e multas,\n`;
    details += `regularize sua situação o quanto antes,\n\n`;
    
    details += `Instruções\n`;
    details += `1. Abra o aplicativo do seu banco\n`;
    details += `2. Escolha a opção PIX\n`;
    details += `3. Escolha "PIX Copia e Cola"\n`;
    details += `4. Cole o código acima\n`;
    details += `5. Confirme o pagamento`;

    const pixCode = pixData.pix_code;

    return { details, pixCode };
  }

  private async updateParcelStatus(parcel: Parcela): Promise<void> {
    try {
      parcel.status = 'pago';
      parcel.data_pagamento = new Date();
      parcel.valor_pago = parcel.valor;
      parcel.forma_pagamento = 'pix';
      await this.parcelRepository.save(parcel);

      // Garante que as datas sejam objetos Date
      const dataVencimento = new Date(parcel.data_vencimento);
      const dataPagamento = new Date(parcel.data_pagamento);
      // Garante que o valor seja um número
      const valor = Number(parcel.valor);

      // Send confirmation message
      const confirmationMessage = `✨ *PAGAMENTO APROVADO COM SUCESSO!* ✨\n\n` +
        `Olá ${parcel.contrato.cliente.nome},\n\n` +
        `É com grande satisfação que informamos que o pagamento da sua parcela foi confirmado!\n\n` +
        `📋 *Detalhes do pagamento:*\n` +
        `• Contrato: ${parcel.contrato_id}\n` +
        `• Parcela: ${parcel.numero_parcela}\n` +
        `• Valor: R$ ${valor.toFixed(2)}\n` +
        `• Data de vencimento: ${dataVencimento.toLocaleDateString()}\n` +
        `• Data de pagamento: ${dataPagamento.toLocaleDateString()}\n\n` +
        `✅ *Status:* Pagamento aprovado e processado com sucesso!\n\n` +
        `Agradecemos a confiança e pontualidade no pagamento. \n` +
        `Se precisar de mais alguma informação, estamos à disposição.\n\n` +
        `Atenciosamente,\nEquipe de Cobrança`;

      await this.whatsappService.sendMessage(
        parcel.contrato.cliente.whatsapp,
        confirmationMessage
      );
    } catch (error) {
      // Safely stringify error object without circular references
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error.response ? {
        status: error.response.status,
        data: error.response.data
      } : {};
      
      this.logger.error(`Error updating parcel status: ${errorMessage}`, errorDetails);
    }
  }
} 