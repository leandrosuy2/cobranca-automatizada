import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qrcode from 'qrcode';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;
  private readonly apiUrl: string;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    this.apiUrl = 'https://api.mercadopago.com';
    if (!this.accessToken) {
      this.logger.error('Token de acesso do Mercado Pago não configurado!');
    }
  }

  async generatePixQRCode(
    valor: number, 
    descricao: string, 
    referencia: string,
    cliente: {
      nome: string;
      email: string;
      cpf?: string;
      telefone?: string;
    }
  ): Promise<{
    qr_code: string;
    qr_code_image: string;
    payment_id: string;
    pix_code: string;
  } | null> {
    try {
      this.logger.debug(`Gerando QR Code PIX para valor: ${valor}, descrição: ${descricao}`);

      const paymentData = {
        transaction_amount: Number(valor),
        description: descricao,
        payment_method_id: 'pix',
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(' ')[0],
          last_name: cliente.nome.split(' ').slice(1).join(' '),
          identification: cliente.cpf ? {
            type: 'CPF',
            number: cliente.cpf.replace(/\D/g, '')
          } : undefined,
          phone: cliente.telefone ? {
            area_code: cliente.telefone.replace(/\D/g, '').substring(0, 2),
            number: cliente.telefone.replace(/\D/g, '').substring(2)
          } : undefined
        },
        external_reference: referencia,
        date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      this.logger.debug('Dados do pagamento:', paymentData);

      // Gera um ID único para idempotência
      const idempotencyKey = uuidv4();

      const response = await axios.post(
        `${this.apiUrl}/v1/payments`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          }
        }
      );

      this.logger.debug('Resposta do Mercado Pago:', response.data);

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(`Falha ao criar pagamento: ${JSON.stringify(response.data)}`);
        return null;
      }

      const payment = response.data;
      if (payment.status !== 'approved' && payment.status !== 'pending') {
        this.logger.error(`Pagamento não aprovado: ${payment.status}`);
        return null;
      }

      const transactionData = payment.point_of_interaction?.transaction_data;
      if (!transactionData?.qr_code) {
        this.logger.error('QR code não encontrado na resposta');
        return null;
      }

      // Gera a imagem do QR code
      const qrCodeImage = await qrcode.toDataURL(transactionData.qr_code);

      // Extrai o código PIX do QR code
      const pixCode = transactionData.qr_code;

      return {
        qr_code: transactionData.qr_code,
        qr_code_image: qrCodeImage,
        payment_id: payment.id.toString(),
        pix_code: pixCode
      };
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        if (error.response.status === 400 && 
            errorData.error === 'bad_request' && 
            errorData.message?.includes('Collector user without key enabled for QR render')) {
          this.logger.error(
            'Erro: Conta do Mercado Pago não tem permissão para gerar QR Code. ' +
            'Por favor, acesse sua conta do Mercado Pago e habilite a funcionalidade de QR Code. ' +
            'Você pode precisar completar a verificação da conta e solicitar permissões adicionais.'
          );
        } else {
          this.logger.error(`Erro na API do Mercado Pago: ${error.response.status} - ${JSON.stringify(errorData)}`);
        }
      } else {
        this.logger.error(`Erro ao gerar QR Code PIX: ${error.message}`);
      }
      return null;
    }
  }

  async checkPaymentStatus(paymentId: string): Promise<boolean> {
    try {
      this.logger.debug(`Verificando status do pagamento ${paymentId}`);
      
      const response = await axios.get(
        `${this.apiUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.debug(`Resposta do Mercado Pago: ${JSON.stringify(response.data)}`);

      // Verifica se o pagamento está aprovado
      const isApproved = response.data.status === 'approved';
      this.logger.debug(`Status do pagamento ${paymentId}: ${response.data.status} (Aprovado: ${isApproved})`);
      
      return isApproved;
    } catch (error) {
      if (error.response) {
        this.logger.error(`Erro na API do Mercado Pago: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Erro ao verificar status do pagamento: ${error.message}`);
      }
      return false;
    }
  }
} 