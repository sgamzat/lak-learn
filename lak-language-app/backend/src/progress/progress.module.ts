import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { SrsService } from './srs.service';

@Module({
  controllers: [ProgressController],
  providers: [SrsService],
  exports: [SrsService],
})
export class ProgressModule {}
