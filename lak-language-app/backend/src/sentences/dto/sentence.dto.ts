import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSentenceDto {
  @ApiProperty()
  @IsString()
  lakText: string;

  @ApiProperty()
  @IsString()
  translation: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number = 1;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  audioUrl?: string;
}

export class UpdateSentenceDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lakText?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  translation?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}
