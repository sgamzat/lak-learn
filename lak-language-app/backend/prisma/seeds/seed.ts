import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash admin password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@laklanguage.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@laklanguage.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      level: 1,
      xp: 0,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create sample words (Lak language)
  const sampleWords = [
    {
      lakWord: 'барз',
      translation: 'медведь',
      transcription: 'barz',
      partOfSpeech: 'существительное',
      topic: 'Животные',
      exampleSentence: 'Барз лесде яхъирчай.',
      difficulty: 1,
    },
    {
      lakWord: 'гьан',
      translation: 'мясо',
      transcription: 'gan',
      partOfSpeech: 'существительное',
      topic: 'Еда',
      exampleSentence: 'Гьан ххуйссар.',
      difficulty: 1,
    },
    {
      lakWord: 'ччатту',
      translation: 'хлеб',
      transcription: 'chattu',
      partOfSpeech: 'существительное',
      topic: 'Еда',
      exampleSentence: 'Ччатту ккалассар.',
      difficulty: 1,
    },
    {
      lakWord: 'цу',
      translation: 'вода',
      transcription: 'tsu',
      partOfSpeech: 'существительное',
      topic: 'Еда',
      exampleSentence: 'Цу ляхъинссар.',
      difficulty: 1,
    },
    {
      lakWord: 'на',
      translation: 'я',
      transcription: 'na',
      partOfSpeech: 'местоимение',
      topic: 'Основные слова',
      exampleSentence: 'На лаккузман.',
      difficulty: 1,
    },
    {
      lakWord: 'ишара',
      translation: 'друг',
      transcription: 'ishara',
      partOfSpeech: 'существительное',
      topic: 'Семья и отношения',
      exampleSentence: 'Ишара ххуйссар.',
      difficulty: 2,
    },
    {
      lakWord: 'нукIу',
      translation: 'птица',
      transcription: 'nuku',
      partOfSpeech: 'существительное',
      topic: 'Животные',
      exampleSentence: 'НукIу ттурлай бур.',
      difficulty: 2,
    },
    {
      lakWord: 'лярс',
      translation: 'гора',
      transcription: 'lyars',
      partOfSpeech: 'существительное',
      topic: 'Природа',
      exampleSentence: 'Лярссур бияла.',
      difficulty: 2,
    },
    {
      lakWord: 'цIусса',
      translation: 'новый',
      transcription: 'tsussa',
      partOfSpeech: 'прилагательное',
      topic: 'Основные слова',
      exampleSentence: 'ЦIусса дом.',
      difficulty: 2,
    },
    {
      lakWord: 'кIул',
      translation: 'знать',
      transcription: 'kul',
      partOfSpeech: 'глагол',
      topic: 'Глаголы',
      exampleSentence: 'На кIулссара.',
      difficulty: 3,
    },
    {
      lakWord: 'бувчIин',
      translation: 'понимать',
      transcription: 'buvchin',
      partOfSpeech: 'глагол',
      topic: 'Глаголы',
      exampleSentence: 'На бувчIинссара.',
      difficulty: 3,
    },
    {
      lakWord: 'махъ',
      translation: 'слово',
      transcription: 'makh',
      partOfSpeech: 'существительное',
      topic: 'Основные слова',
      exampleSentence: 'Махъ ххуйссар.',
      difficulty: 2,
    },
    {
      lakWord: 'зазу',
      translation: 'отец',
      transcription: 'zazu',
      partOfSpeech: 'существительное',
      topic: 'Семья и отношения',
      exampleSentence: 'Зазу ххуйссар.',
      difficulty: 1,
    },
    {
      lakWord: 'русттан',
      translation: 'мать',
      transcription: 'rusttan',
      partOfSpeech: 'существительное',
      topic: 'Семья и отношения',
      exampleSentence: 'Русттан ххуйссар.',
      difficulty: 1,
    },
    {
      lakWord: 'ша',
      translation: 'три',
      transcription: 'sha',
      partOfSpeech: 'числительное',
      topic: 'Числа',
      exampleSentence: 'Ша инсан.',
      difficulty: 1,
    },
  ];

  for (const wordData of sampleWords) {
    await prisma.word.upsert({
      where: { 
        lakWord_translation: {
          lakWord: wordData.lakWord,
          translation: wordData.translation,
        },
      },
      update: wordData,
      create: wordData,
    });
    console.log(`✅ Word created: ${wordData.lakWord} - ${wordData.translation}`);
  }

  // Create sample sentences
  const sampleSentences = [
    {
      lakText: 'На лаккузман.',
      translation: 'Я изучаю лакский язык.',
      difficulty: 1,
      topic: 'Основные фразы',
    },
    {
      lakText: 'Ишара ххуйссар.',
      translation: 'Друг хороший.',
      difficulty: 1,
      topic: 'Основные фразы',
    },
    {
      lakText: 'Барз лесде яхъирчай.',
      translation: 'Медведь в лесу живёт.',
      difficulty: 2,
      topic: 'Животные',
    },
    {
      lakText: 'Зазу ва русттан ххуйсса инсантал.',
      translation: 'Отец и мать хорошие люди.',
      difficulty: 3,
      topic: 'Семья',
    },
    {
      lakText: 'Лярссур бияла.',
      translation: 'Гора большая.',
      difficulty: 1,
      topic: 'Природа',
    },
    {
      lakText: 'На кIулссара лакку маз.',
      translation: 'Я знаю лакский язык.',
      difficulty: 2,
      topic: 'Язык',
    },
    {
      lakText: 'ЦIусса ччатту ккалассар.',
      translation: 'Новый хлеб вкусный.',
      difficulty: 2,
      topic: 'Еда',
    },
    {
      lakText: 'НукIу ттурлай бур.',
      translation: 'Птица летает.',
      difficulty: 1,
      topic: 'Животные',
    },
  ];

  for (const sentenceData of sampleSentences) {
    await prisma.sentence.create({
      data: sentenceData,
    });
    console.log(`✅ Sentence created: ${sentenceData.lakText}`);
  }

  // Create achievements
  const achievements = [
    {
      name: 'Первые шаги',
      description: 'Изучите первые 10 слов',
      icon: '🎯',
      requirement: 10,
      type: 'WORDS_LEARNED',
    },
    {
      name: 'Начинающий',
      description: 'Наберите 100 XP',
      icon: '⭐',
      requirement: 100,
      type: 'XP_THRESHOLD',
    },
    {
      name: 'Неделя без перерыва',
      description: 'Поддерживайте серию 7 дней',
      icon: '🔥',
      requirement: 7,
      type: 'STREAK',
    },
    {
      name: 'Полиглот',
      description: 'Изучите 100 слов',
      icon: '📚',
      requirement: 100,
      type: 'WORDS_LEARNED',
    },
    {
      name: 'Мастер предложений',
      description: 'Изучите 50 предложений',
      icon: '✍️',
      requirement: 50,
      type: 'SENTENCES_LEARNED',
    },
  ];

  for (const achievementData of achievements) {
    await prisma.achievement.create({
      data: achievementData,
    });
    console.log(`✅ Achievement created: ${achievementData.name}`);
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
