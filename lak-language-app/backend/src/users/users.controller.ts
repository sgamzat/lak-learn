import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/user.dto';
import { PrismaService } from '../common/prisma.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        level: true,
        xp: true,
        streak: true,
        lastActivity: true,
        createdAt: true,
      },
    });

    return user;
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        level: true,
        xp: true,
        streak: true,
      },
    });

    return user;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Req() req: any) {
    const userId = req.user.userId;

    const [wordProgress, sentenceProgress, achievements] = await Promise.all([
      this.prisma.userWordProgress.count({
        where: { userId, known: true },
      }),
      this.prisma.userSentenceProgress.count({
        where: { userId, known: true },
      }),
      this.prisma.userAchievement.count({
        where: { userId },
      }),
    ]);

    const totalPractices = await this.prisma.userWordProgress.aggregate({
      where: { userId },
      _sum: {
        correctCount: true,
        incorrectCount: true,
      },
    });

    return {
      wordsLearned: wordProgress,
      sentencesLearned: sentenceProgress,
      achievementsUnlocked: achievements,
      totalCorrectAnswers: totalPractices._sum.correctCount || 0,
      totalIncorrectAnswers: totalPractices._sum.incorrectCount || 0,
    };
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get user learning progress' })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  async getProgress(@Req() req: any) {
    const userId = req.user.userId;

    const [wordsToReview, recentWords, recentSentences] = await Promise.all([
      this.prisma.userWordProgress.findMany({
        where: {
          userId,
          nextReview: { lte: new Date() },
        },
        include: { word: true },
        take: 20,
      }),
      this.prisma.userWordProgress.findMany({
        where: { userId },
        include: { word: true },
        orderBy: { lastPracticed: 'desc' },
        take: 10,
      }),
      this.prisma.userSentenceProgress.findMany({
        where: { userId },
        include: { sentence: true },
        orderBy: { lastPracticed: 'desc' },
        take: 10,
      }),
    ]);

    return {
      wordsToReview: wordsToReview.length,
      recentWords,
      recentSentences,
    };
  }
}
