import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CreateSentenceDto, UpdateSentenceDto } from './dto/sentence.dto';

@ApiTags('Sentences')
@Controller('sentences')
export class SentencesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get sentences with filters' })
  @ApiResponse({ status: 200, description: 'Sentences retrieved successfully' })
  async getSentences(
    @Query('topic') topic?: string,
    @Query('difficulty') difficulty?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const where: any = { isActive: true };

    if (topic) {
      where.topic = topic;
    }

    if (difficulty) {
      where.difficulty = parseInt(difficulty.toString());
    }

    return this.prisma.sentence.findMany({
      where,
      take: limit ? parseInt(limit.toString()) : 50,
      skip: offset ? parseInt(offset.toString()) : 0,
      orderBy: { difficulty: 'asc' },
      include: {
        words: {
          include: { word: true },
        },
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sentence by ID' })
  @ApiResponse({ status: 200, description: 'Sentence retrieved successfully' })
  async getSentence(@Param('id') id: string) {
    return this.prisma.sentence.findUnique({
      where: { id },
      include: {
        words: {
          include: { word: true },
        },
      },
    });
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new sentence (Admin only)' })
  @ApiResponse({ status: 201, description: 'Sentence created successfully' })
  async createSentence(@Body() createSentenceDto: CreateSentenceDto) {
    return this.prisma.sentence.create({
      data: createSentenceDto,
    });
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update sentence (Admin only)' })
  @ApiResponse({ status: 200, description: 'Sentence updated successfully' })
  async updateSentence(
    @Param('id') id: string,
    @Body() updateSentenceDto: UpdateSentenceDto,
  ) {
    return this.prisma.sentence.update({
      where: { id },
      data: updateSentenceDto,
    });
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete sentence (Admin only)' })
  @ApiResponse({ status: 200, description: 'Sentence deleted successfully' })
  async deleteSentence(@Param('id') id: string) {
    // Soft delete - set isActive to false
    return this.prisma.sentence.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
