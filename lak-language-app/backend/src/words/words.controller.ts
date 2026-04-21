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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CreateWordDto, UpdateWordDto } from './dto/word.dto';

@ApiTags('Words')
@Controller('words')
export class WordsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get words with filters' })
  @ApiResponse({ status: 200, description: 'Words retrieved successfully' })
  async getWords(
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

    return this.prisma.word.findMany({
      where,
      take: limit ? parseInt(limit.toString()) : 50,
      skip: offset ? parseInt(offset.toString()) : 0,
      orderBy: { difficulty: 'asc' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get word by ID' })
  @ApiResponse({ status: 200, description: 'Word retrieved successfully' })
  async getWord(@Param('id') id: string) {
    return this.prisma.word.findUnique({
      where: { id },
      include: {
        sentences: {
          include: { sentence: true },
        },
      },
    });
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new word (Admin only)' })
  @ApiResponse({ status: 201, description: 'Word created successfully' })
  async createWord(@Body() createWordDto: CreateWordDto) {
    return this.prisma.word.create({
      data: createWordDto,
    });
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update word (Admin only)' })
  @ApiResponse({ status: 200, description: 'Word updated successfully' })
  async updateWord(
    @Param('id') id: string,
    @Body() updateWordDto: UpdateWordDto,
  ) {
    return this.prisma.word.update({
      where: { id },
      data: updateWordDto,
    });
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete word (Admin only)' })
  @ApiResponse({ status: 200, description: 'Word deleted successfully' })
  async deleteWord(@Param('id') id: string) {
    // Soft delete - set isActive to false
    return this.prisma.word.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
