import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class ImportWordsDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  words: Array<{
    lakWord: string;
    translation: string;
    transcription?: string;
    partOfSpeech?: string;
    topic: string;
    exampleSentence?: string;
    difficulty?: number;
  }>;
}

export class ImportSentencesDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  sentences: Array<{
    lakText: string;
    translation: string;
    difficulty?: number;
    topic?: string;
  }>;
}
