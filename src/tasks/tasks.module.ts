import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ParcelCheckerTask } from './parcel-checker.task';
import { ParcelModule } from '../parcel/parcel.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ParcelModule,
  ],
  providers: [ParcelCheckerTask],
})
export class TasksModule {} 