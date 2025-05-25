import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

  private isValidCPF(cpf: string): boolean {
    // Remove caracteres não numéricos
    cpf = cpf.replace(/\D/g, '');

    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) {
      return false;
    }

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) {
      return false;
    }

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let rest = 11 - (sum % 11);
    let digit1 = rest > 9 ? 0 : rest;
    if (digit1 !== parseInt(cpf.charAt(9))) {
      return false;
    }

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    rest = 11 - (sum % 11);
    let digit2 = rest > 9 ? 0 : rest;
    if (digit2 !== parseInt(cpf.charAt(10))) {
      return false;
    }

    return true;
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
    payment_id: string;
    pix_code: string;
  } | null> {
    try {
      this.logger.debug(`Gerando código PIX para valor: ${valor}, descrição: ${descricao}`);

      // Formata e valida o CPF
      let formattedCpf: string | undefined;
      if (cliente.cpf) {
        this.logger.debug(`CPF original recebido: ${cliente.cpf}`);
        
        // Remove todos os caracteres não numéricos
        const cpfNumbers = cliente.cpf.replace(/\D/g, '');
        this.logger.debug(`CPF após remoção de caracteres não numéricos: ${cpfNumbers}`);
        
        // Verifica se o CPF é válido
        if (!this.isValidCPF(cpfNumbers)) {
          this.logger.error(`CPF inválido: ${cliente.cpf} - Não passou na validação do algoritmo de CPF`);
          return null;
        }
        
        formattedCpf = cpfNumbers;
        this.logger.debug(`CPF formatado final: ${formattedCpf}`);
      } else {
        this.logger.debug('Nenhum CPF fornecido para o cliente');
      }

      const paymentData = {
        transaction_amount: Number(valor),
        description: descricao,
        payment_method_id: 'pix',
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(' ')[0],
          last_name: cliente.nome.split(' ').slice(1).join(' '),
          identification: formattedCpf ? {
            type: 'CPF',
            number: formattedCpf
          } : undefined,
          phone: cliente.telefone ? {
            area_code: cliente.telefone.replace(/\D/g, '').substring(0, 2),
            number: cliente.telefone.replace(/\D/g, '').substring(2)
          } : undefined
        },
        external_reference: referencia,
        date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      this.logger.debug('Dados do pagamento:', JSON.stringify(paymentData, null, 2));

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
        this.logger.error('Código PIX não encontrado na resposta');
        return null;
      }

      return {
        payment_id: payment.id.toString(),
        pix_code: transactionData.qr_code
      };
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        if (error.response.status === 400 && 
            errorData.error === 'bad_request' && 
            errorData.message?.includes('Collector user without key enabled for QR render')) {
          this.logger.error(
            'Erro: Conta do Mercado Pago não tem permissão para gerar código PIX. ' +
            'Por favor, acesse sua conta do Mercado Pago e habilite a funcionalidade de PIX. ' +
            'Você pode precisar completar a verificação da conta e solicitar permissões adicionais.'
          );
        } else {
          this.logger.error(`Erro na API do Mercado Pago: ${error.response.status} - ${JSON.stringify(errorData)}`);
        }
      } else {
        this.logger.error(`Erro ao gerar código PIX: ${error.message}`);
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