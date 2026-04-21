import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWordDto {
  @ApiProperty()
  @IsString()
  lakWord: string;

  @ApiProperty()
  @IsString()
  translation: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transcription?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @ApiProperty()
  @IsString()
  topic: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  exampleSentence?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number = 1;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class UpdateWordDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lakWord?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  translation?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transcription?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partOfSpeech?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  exampleSentence?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  audioUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}

export class WordResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  lakWord: string;

  @ApiProperty()
  translation: string;

  @ApiProperty({ required: false })
  transcription?: string;

  @ApiProperty({ required: false })
  partOfSpeech?: string;

  @ApiProperty()
  topic: string;

  @ApiProperty({ required: false })
  exampleSentence?: string;

  @ApiProperty()
  difficulty: number;

  @ApiProperty({ required: false })
  audioUrl?: string;

  @ApiProperty({ required: false })
  imageUrl?: string;
}
