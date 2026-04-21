import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SrsService } from './srs.service';
import { PracticeWordDto, PracticeSentenceDto } from './dto/progress.dto';

@ApiTags('Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(
    private prisma: PrismaService,
    private srsService: SrsService,
  ) {}

  @Post('words/:id/practice')
  @ApiOperation({ summary: 'Practice a word' })
  @ApiResponse({ status: 200, description: 'Practice recorded successfully' })
  async practiceWord(
    @Req() req: any,
    @Param('id') wordId: string,
    @Body() practiceDto: PracticeWordDto,
  ) {
    const userId = req.user.userId;
    const { correct } = practiceDto;

    // Get word for difficulty
    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
    });

    if (!word) {
      throw new Error('Word not found');
    }

    // Get or create progress
    let progress = await this.prisma.userWordProgress.findUnique({
      where: {
        userId_wordId: {
          userId,
          wordId,
        },
      },
    });

    if (!progress) {
      progress = await this.prisma.userWordProgress.create({
        data: {
          userId,
          wordId,
          nextReview: new Date(),
        },
      });
    }

    // Calculate SRS updates
    const { interval, easeFactor } = this.srsService.calculateNextReview(
      progress.interval,
      progress.easeFactor,
      correct,
    );

    const nextReview = this.srsService.getNextReviewDate(interval);
    const xpReward = this.srsService.calculateXpReward(
      correct,
      word.difficulty,
      progress.repeats,
    );

    // Update progress
    const updatedProgress = await this.prisma.userWordProgress.update({
      where: { id: progress.id },
      data: {
        known: correct && progress.repeats >= 3,
        repeats: progress.repeats + 1,
        easeFactor,
        interval,
        nextReview,
        lastPracticed: new Date(),
        correctCount: progress.correctCount + (correct ? 1 : 0),
        incorrectCount: progress.incorrectCount + (correct ? 0 : 1),
      },
      include: { word: true },
    });

    // Update user XP and level if correct
    if (correct && xpReward > 0) {
      await this.updateUserXp(userId, xpReward);
    }

    return {
      progress: updatedProgress,
      xpEarned: xpReward,
    };
  }

  @Post('sentences/:id/practice')
  @ApiOperation({ summary: 'Practice a sentence' })
  @ApiResponse({ status: 200, description: 'Practice recorded successfully' })
  async practiceSentence(
    @Req() req: any,
    @Param('id') sentenceId: string,
    @Body() practiceDto: PracticeSentenceDto,
  ) {
    const userId = req.user.userId;
    const { correct } = practiceDto;

    // Get sentence for difficulty
    const sentence = await this.prisma.sentence.findUnique({
      where: { id: sentenceId },
    });

    if (!sentence) {
      throw new Error('Sentence not found');
    }

    // Get or create progress
    let progress = await this.prisma.userSentenceProgress.findUnique({
      where: {
        userId_sentenceId: {
          userId,
          sentenceId,
        },
      },
    });

    if (!progress) {
      progress = await this.prisma.userSentenceProgress.create({
        data: {
          userId,
          sentenceId,
          nextReview: new Date(),
        },
      });
    }

    // Calculate SRS updates
    const { interval, easeFactor } = this.srsService.calculateNextReview(
      progress.interval,
      progress.easeFactor,
      correct,
    );

    const nextReview = this.srsService.getNextReviewDate(interval);
    const xpReward = this.srsService.calculateXpReward(
      correct,
      sentence.difficulty,
      progress.repeats,
    );

    // Update progress
    const updatedProgress = await this.prisma.userSentenceProgress.update({
      where: { id: progress.id },
      data: {
        known: correct && progress.repeats >= 3,
        repeats: progress.repeats + 1,
        easeFactor,
        interval,
        nextReview,
        lastPracticed: new Date(),
        correctCount: progress.correctCount + (correct ? 1 : 0),
        incorrectCount: progress.incorrectCount + (correct ? 0 : 1),
      },
      include: { sentence: true },
    });

    // Update user XP and level if correct
    if (correct && xpReward > 0) {
      await this.updateUserXp(userId, xpReward);
    }

    return {
      progress: updatedProgress,
      xpEarned: xpReward,
    };
  }

  @Get('words/due')
  @ApiOperation({ summary: 'Get words due for review' })
  @ApiResponse({ status: 200, description: 'Words retrieved successfully' })
  async getWordsDueForReview(@Req() req: any, @Query('limit') limit?: number) {
    const userId = req.user.userId;
    const now = new Date();

    const dueWords = await this.prisma.userWordProgress.findMany({
      where: {
        userId,
        nextReview: { lte: now },
      },
      include: { word: true },
      take: limit ? parseInt(limit.toString()) : 20,
      orderBy: { nextReview: 'asc' },
    });

    return dueWords;
  }

  @Get('sentences/due')
  @ApiOperation({ summary: 'Get sentences due for review' })
  @ApiResponse({ status: 200, description: 'Sentences retrieved successfully' })
  async getSentencesDueForReview(@Req() req: any, @Query('limit') limit?: number) {
    const userId = req.user.userId;
    const now = new Date();

    const dueSentences = await this.prisma.userSentenceProgress.findMany({
      where: {
        userId,
        nextReview: { lte: now },
      },
      include: { sentence: true },
      take: limit ? parseInt(limit.toString()) : 10,
      orderBy: { nextReview: 'asc' },
    });

    return dueSentences;
  }

  /**
   * Update user XP and level
   */
  private async updateUserXp(userId: string, xpAmount: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const newXp = user.xp + xpAmount;
    const newLevel = Math.floor(newXp / 100) + 1;

    // Update streak if first activity today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActivity = user.lastActivity ? new Date(user.lastActivity) : null;
    
    let newStreak = user.streak;
    if (lastActivity) {
      const daysSinceLastActivity = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );
      
      if (daysSinceLastActivity === 1) {
        newStreak += 1;
      } else if (daysSinceLastActivity > 1) {
        newStreak = 1; // Reset streak
      }
      // If daysSinceLastActivity === 0, keep same streak
    } else {
      newStreak = 1; // First activity ever
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        lastActivity: new Date(),
      },
    });
  }
}
