import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ImportWordsDto, ImportSentencesDto } from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  // ===== Words Management =====

  @Get('words')
  @ApiOperation({ summary: 'Get all words (Admin)' })
  async getAllWords(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.prisma.word.findMany({
      take: limit ? parseInt(limit.toString()) : 100,
      skip: offset ? parseInt(offset.toString()) : 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('words/import')
  @ApiOperation({ summary: 'Import multiple words (Admin)' })
  @ApiResponse({ status: 201, description: 'Words imported successfully' })
  async importWords(@Body() importDto: ImportWordsDto) {
    const created = [];
    
    for (const wordData of importDto.words) {
      const word = await this.prisma.word.create({
        data: wordData,
      });
      created.push(word);
    }

    return { count: created.length, words: created };
  }

  @Get('analytics/words')
  @ApiOperation({ summary: 'Get words analytics (Admin)' })
  async getWordsAnalytics() {
    const [totalWords, wordsByTopic, wordsByDifficulty, mostPracticedWords] = await Promise.all([
      this.prisma.word.count(),
      
      this.prisma.word.groupBy({
        by: ['topic'],
        _count: true,
      }),
      
      this.prisma.word.groupBy({
        by: ['difficulty'],
        _count: true,
        orderBy: { difficulty: 'asc' },
      }),
      
      this.prisma.userWordProgress.groupBy({
        by: ['wordId'],
        _count: true,
        orderBy: { _count: { wordId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalWords,
      wordsByTopic,
      wordsByDifficulty,
      mostPracticedWords,
    };
  }

  // ===== Sentences Management =====

  @Get('sentences')
  @ApiOperation({ summary: 'Get all sentences (Admin)' })
  async getAllSentences(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.prisma.sentence.findMany({
      take: limit ? parseInt(limit.toString()) : 100,
      skip: offset ? parseInt(offset.toString()) : 0,
      orderBy: { createdAt: 'desc' },
      include: {
        words: {
          include: { word: true },
        },
      },
    });
  }

  @Post('sentences/import')
  @ApiOperation({ summary: 'Import multiple sentences (Admin)' })
  @ApiResponse({ status: 201, description: 'Sentences imported successfully' })
  async importSentences(@Body() importDto: ImportSentencesDto) {
    const created = [];
    
    for (const sentenceData of importDto.sentences) {
      const sentence = await this.prisma.sentence.create({
        data: sentenceData,
      });
      created.push(sentence);
    }

    return { count: created.length, sentences: created };
  }

  @Get('analytics/sentences')
  @ApiOperation({ summary: 'Get sentences analytics (Admin)' })
  async getSentencesAnalytics() {
    const [totalSentences, sentencesByTopic, sentencesByDifficulty] = await Promise.all([
      this.prisma.sentence.count(),
      
      this.prisma.sentence.groupBy({
        by: ['topic'],
        _count: true,
      }),
      
      this.prisma.sentence.groupBy({
        by: ['difficulty'],
        _count: true,
        orderBy: { difficulty: 'asc' },
      }),
    ]);

    return {
      totalSentences,
      sentencesByTopic,
      sentencesByDifficulty,
    };
  }

  // ===== Users Analytics =====

  @Get('analytics/users')
  @ApiOperation({ summary: 'Get users analytics (Admin)' })
  async getUsersAnalytics() {
    const [totalUsers, activeUsers, averageXp, topUsers] = await Promise.all([
      this.prisma.user.count(),
      
      this.prisma.user.count({
        where: {
          lastActivity: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
      
      this.prisma.user.aggregate({
        _avg: { xp: true },
      }),
      
      this.prisma.user.findMany({
        orderBy: { xp: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          xp: true,
          level: true,
          streak: true,
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      averageXp: Math.round(avgXp._avg.xp || 0),
      topUsers,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin)' })
  async getAllUsers(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.prisma.user.findMany({
      take: limit ? parseInt(limit.toString()) : 50,
      skip: offset ? parseInt(offset.toString()) : 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        level: true,
        xp: true,
        streak: true,
        lastActivity: true,
        createdAt: true,
      },
    });
  }

  // ===== Dashboard Overview =====

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview (Admin)' })
  async getDashboard() {
    const [
      totalUsers,
      totalWords,
      totalSentences,
      totalAchievements,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.word.count({ where: { isActive: true } }),
      this.prisma.sentence.count({ where: { isActive: true } }),
      this.prisma.achievement.count(),
      this.prisma.activityLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      totalUsers,
      totalWords,
      totalSentences,
      totalAchievements,
      recentActivity,
    };
  }
}
