import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcela } from '../entities/parcela.entity';
import { ControleEmails } from '../entities/controle-emails.entity';
import { ParcelService } from '../services/parcel.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { MercadoPagoService } from '../services/mercadopago.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([Parcela, ControleEmails], 'default'),
  ],
  providers: [ParcelService, WhatsAppService, MercadoPagoService],
  exports: [ParcelService],
})
export class ParcelModule {} 