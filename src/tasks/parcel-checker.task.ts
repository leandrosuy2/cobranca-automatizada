import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ParcelService } from '../services/parcel.service';

@Injectable()
export class ParcelCheckerTask {
  private readonly logger = new Logger(ParcelCheckerTask.name);

  constructor(private parcelService: ParcelService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleParcelCheck() {
    try {
      this.logger.debug('Verificando se há parcelas que precisam ser processadas...');
      await this.parcelService.checkAndProcessParcels();
    } catch (error) {
      this.logger.error(`Erro no processo de verificação de parcelas: ${error.message}`);
    }
  }
} 