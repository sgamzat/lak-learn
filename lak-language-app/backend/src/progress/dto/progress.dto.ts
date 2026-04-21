import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PracticeWordDto {
  @ApiProperty({ description: 'Was the answer correct?' })
  @IsBoolean()
  correct: boolean;

  @ApiProperty({ description: 'User answer (optional)', required: false })
  @IsOptional()
  userAnswer?: string;
}

export class PracticeSentenceDto {
  @ApiProperty({ description: 'Was the answer correct?' })
  @IsBoolean()
  correct: boolean;

  @ApiProperty({ description: 'User answer (optional)', required: false })
  @IsOptional()
  userAnswer?: string;
}
