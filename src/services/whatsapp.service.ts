import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instanceId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY');
    this.instanceId = this.configService.get<string>('INSTANCE_ID');

    // Log das configurações (sem mostrar a chave completa por segurança)
    this.logger.debug(`WhatsApp Service initialized with:`);
    this.logger.debug(`API URL: ${this.apiUrl}`);
    this.logger.debug(`API Key: ${this.apiKey ? 'Configured' : 'Not configured'}`);
    this.logger.debug(`Instance ID: ${this.instanceId}`);

    if (!this.apiUrl || !this.apiKey || !this.instanceId) {
      this.logger.error('Configurações do WhatsApp não encontradas!');
      this.logger.error(`API URL: ${this.apiUrl ? 'OK' : 'Faltando'}`);
      this.logger.error(`API Key: ${this.apiKey ? 'OK' : 'Faltando'}`);
      this.logger.error(`Instance ID: ${this.instanceId ? 'OK' : 'Faltando'}`);
    }
  }

  async sendMessage(phoneNumber: string, message: string, qrCodeImage?: string): Promise<boolean> {
    try {
      // Clean phone number
      const originalNumber = phoneNumber;
      phoneNumber = phoneNumber.replace(/\D/g, '');
      if (!phoneNumber.startsWith('55')) {
        phoneNumber = '55' + phoneNumber;
      }

      this.logger.debug(`Preparando envio de mensagem para número: ${originalNumber} (formatado: ${phoneNumber})`);

      const headers = {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      };

      // Send text message
      const textPayload = {
        number: phoneNumber,
        text: message
      };

      this.logger.debug(`Enviando mensagem de texto para ${this.apiUrl}/message/sendText/${this.instanceId}`);
      this.logger.debug(`Payload da mensagem: ${JSON.stringify(textPayload)}`);

      const textResponse = await axios.post(
        `${this.apiUrl}/message/sendText/${this.instanceId}`,
        textPayload,
        { 
          headers,
          httpsAgent: new (require('https').Agent)({  
            rejectUnauthorized: false
          })
        }
      );

      this.logger.debug(`Resposta do envio de texto: ${JSON.stringify(textResponse.data)}`);

      if (textResponse.status !== 200 && textResponse.status !== 201) {
        this.logger.error(`Falha ao enviar mensagem de texto: ${JSON.stringify(textResponse.data)}`);
        return false;
      }

      // If QR code image is provided, send it
      if (qrCodeImage) {
        this.logger.debug('Preparando envio da imagem do QR code...');
        
        // Remove o prefixo data:image/png;base64, se existir
        const base64Image = qrCodeImage.replace(/^data:image\/\w+;base64,/, '');
        
        const imagePayload = {
          number: phoneNumber,
          mediatype: 'image',
          media: base64Image,
          caption: 'QR Code PIX para pagamento'
        };

        this.logger.debug(`Enviando imagem para ${this.apiUrl}/message/sendMedia/${this.instanceId}`);
        this.logger.debug(`Tamanho da imagem em base64: ${base64Image.length} caracteres`);

        const imageResponse = await axios.post(
          `${this.apiUrl}/message/sendMedia/${this.instanceId}`,
          imagePayload,
          { 
            headers,
            httpsAgent: new (require('https').Agent)({  
              rejectUnauthorized: false
            })
          }
        );

        this.logger.debug(`Resposta do envio de imagem: ${JSON.stringify(imageResponse.data)}`);

        if (imageResponse.status !== 200 && imageResponse.status !== 201) {
          this.logger.error(`Falha ao enviar imagem do QR code: ${JSON.stringify(imageResponse.data)}`);
          return false;
        }

        this.logger.debug('QR code enviado com sucesso');
      }

      this.logger.debug(`Mensagem enviada com sucesso para ${phoneNumber}`);
      return true;
    } catch (error) {
      if (error.response) {
        this.logger.error(`Erro ao enviar mensagem WhatsApp: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        this.logger.error(`URL da requisição: ${error.config?.url}`);
        this.logger.error(`Método: ${error.config?.method}`);
        this.logger.error(`Headers: ${JSON.stringify(error.config?.headers)}`);
      } else if (error.request) {
        this.logger.error(`Erro na requisição: ${error.message}`);
        this.logger.error(`Request: ${JSON.stringify(error.request)}`);
      } else {
        this.logger.error(`Erro ao enviar mensagem WhatsApp: ${error.message}`);
      }
      return false;
    }
  }
} 