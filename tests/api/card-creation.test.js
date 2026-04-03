// API интеграционные тесты для создания новых карточек
import request from 'supertest';
import {
  testLog,
  readUserData,
  startServer,
  stopServer
} from '../test-utils.js';

const BASE_URL = 'http://localhost:8085';
const TEST_USERNAME = 'autotest_user';
const TEST_PASSWORD = 'autotest123';

// Тестовые данные для создания новой карточки
const NEW_QUESTION = 'Тестовый вопрос для создания [авто-тест]';
const NEW_ANSWER = 'Тестовый ответ для создания [авто-тест]';

let authToken = null;

describe('API Integration Tests - Card Creation', () => {

  beforeAll(async () => {
    testLog('=== НАЧАЛО ТЕСТОВ СОЗДАНИЯ КАРТОЧЕК ===');
    await startServer(8085);

    // Логин
    const loginRes = await request(BASE_URL)
      .post('/api/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.token || 'test_token';
    testLog('Логин успешен', { username: TEST_USERNAME });
  }, 60000);

  afterAll(async () => {
    testLog('=== ЗАВЕРШЕНИЕ ТЕСТОВ ===');
    await stopServer();
  }, 30000);

  describe('POST /api/card/create', () => {
    it('должна успешно создать новую карточку', async () => {
      const initialData = readUserData(TEST_USERNAME);
      const initialCount = initialData?._cards?.length || 0;

      testLog('Начальное количество карточек', { count: initialCount });

      const res = await request(BASE_URL)
        .post('/api/card/create')
        .query({ username: TEST_USERNAME })
        .send({
          question: NEW_QUESTION,
          answer: NEW_ANSWER,
          formatting: { question: [], answer: [] }
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.card).toBeDefined();
      expect(res.body.card.question).toBe(NEW_QUESTION);
      expect(res.body.card.answer).toBe(NEW_ANSWER);
      expect(res.body.totalCards).toBe(initialCount + 1);

      testLog('Карточка создана', {
        question: res.body.card.question,
        totalCards: res.body.totalCards
      });

      // Проверим что карточка действительно сохранена в файле
      const updatedData = readUserData(TEST_USERNAME);
      const createdCard = updatedData?._cards?.find(c => c.question === NEW_QUESTION);
      
      expect(createdCard).toBeDefined();
      expect(createdCard.answer).toBe(NEW_ANSWER);
      expect(createdCard.category).toBe('Без категории');
      expect(createdCard.subcategory).toBe('Общее');

      testLog('Карточка найдена в файле после создания', {
        question: createdCard?.question?.substring(0, 50)
      });
    }, 30000);

    it('должна отклонить запрос без вопроса', async () => {
      const res = await request(BASE_URL)
        .post('/api/card/create')
        .query({ username: TEST_USERNAME })
        .send({
          answer: NEW_ANSWER
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('question and answer required');

      testLog('Запрос без вопроса отклонён', { error: res.body.error });
    }, 10000);

    it('должна отклонить запрос без ответа', async () => {
      const res = await request(BASE_URL)
        .post('/api/card/create')
        .query({ username: TEST_USERNAME })
        .send({
          question: NEW_QUESTION
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('question and answer required');

      testLog('Запрос без ответа отклонён', { error: res.body.error });
    }, 10000);

    it('должна отклонить запрос без username', async () => {
      const res = await request(BASE_URL)
        .post('/api/card/create')
        .send({
          question: NEW_QUESTION,
          answer: NEW_ANSWER
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('username required');

      testLog('Запрос без username отклонён', { error: res.body.error });
    }, 10000);

    it('должна создать карточку с пустым formatting', async () => {
      const questionWithFormatting = 'Вопрос с форматированием [авто-тест]';
      const answerWithFormatting = 'Ответ с форматированием [авто-тест]';

      const res = await request(BASE_URL)
        .post('/api/card/create')
        .query({ username: TEST_USERNAME })
        .send({
          question: questionWithFormatting,
          answer: answerWithFormatting,
          formatting: {
            question: [{ start: 0, end: 5, color: '#FF0000', bold: true }],
            answer: []
          }
        })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.card.formatting).toBeDefined();
      expect(res.body.card.formatting.question).toEqual([
        { start: 0, end: 5, color: '#FF0000', bold: true }
      ]);

      testLog('Карточка с форматированием создана', {
        question: questionWithFormatting,
        hasFormatting: true
      });

      // Проверим что formatting сохранился
      const updatedData = readUserData(TEST_USERNAME);
      const createdCard = updatedData?._cards?.find(c => c.question === questionWithFormatting);
      
      expect(createdCard).toBeDefined();
      expect(createdCard.formatting).toBeDefined();
      expect(createdCard.formatting.question).toEqual([
        { start: 0, end: 5, color: '#FF0000', bold: true }
      ]);
    }, 30000);
  });
});
