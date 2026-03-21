// API интеграционные тесты для редактирования карточек
import request from 'supertest';
import { 
  testLog, 
  readUserData, 
  assertCardExists, 
  startServer, 
  stopServer,
  restartServer,
  getFileHash
} from '../test-utils.js';

const BASE_URL = 'http://localhost:8085';
const TEST_USERNAME = 'autotest_user';
const TEST_PASSWORD = 'autotest123';

// Тестовая карточка для редактирования
const ORIGINAL_QUESTION = 'Медленный деплой';
const EDITED_QUESTION_1 = 'Медленный деплой [тест1]';
const EDITED_QUESTION_2 = 'Медленный деплой [тест1][тест2]';

let authToken = null;
let originalCardData = null;

describe('API Integration Tests - Card Editing', () => {
  
  beforeAll(async () => {
    testLog('=== НАЧАЛО ТЕСТОВ ===');
    await startServer(8085);
    
    // Логин
    const loginRes = await request(BASE_URL)
      .post('/api/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    
    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.token || 'test_token';
    testLog('Логин успешен', { username: TEST_USERNAME });
    
    // Сохранить оригинальные данные карточки
    const userData = readUserData(TEST_USERNAME);
    originalCardData = userData?._cards?.find(c => c.question === ORIGINAL_QUESTION);
    testLog('Оригинальная карточка найдена', { 
      exists: !!originalCardData,
      question: originalCardData?.question?.substring(0, 50)
    });
  }, 60000);
  
  afterAll(async () => {
    testLog('=== ЗАВЕРШЕНИЕ ТЕСТОВ ===');
    await stopServer();
  }, 60000);
  
  /**
   * ТЕСТ 1: Одиночное редактирование карточки
   */
  describe('Test 1: Single Card Edit', () => {
    it('should successfully edit a card once', async () => {
      testLog('Тест 1: Начало одиночного редактирования');
      
      // Получить хеш файла до изменения
      const hashBefore = getFileHash(`data/user_${TEST_USERNAME}.json`);
      testLog('Хеш файла до изменения', { hash: hashBefore?.substring(0, 50) });
      
      // Редактировать карточку
      const editRes = await request(BASE_URL)
        .post(`/api/card/update?username=${TEST_USERNAME}`)
        .send({
          oldQuestion: ORIGINAL_QUESTION,
          newQuestion: EDITED_QUESTION_1,
          newAnswer: originalCardData?.answer || 'test answer'
        });
      
      testLog('Ответ сервера на редактирование', {
        status: editRes.status,
        body: editRes.body
      });
      
      // Проверка ответа
      expect(editRes.status).toBe(200);
      expect(editRes.body.ok).toBe(true);
      expect(editRes.body.debug?.cardFoundInFile).toBe(true);
      
      // Проверка файла
      const userData = readUserData(TEST_USERNAME);
      assertCardExists(userData, EDITED_QUESTION_1, 'После первого редактирования');
      
      const hashAfter = getFileHash(`data/user_${TEST_USERNAME}.json`);
      testLog('Хеш файла после изменения', { hash: hashAfter?.substring(0, 50) });
      
      expect(hashBefore).not.toBe(hashAfter);
      testLog('Тест 1: Успешно пройден');
    }, 10000);
  });
  
  /**
   * ТЕСТ 2: Двойное редактирование карточки
   */
  describe('Test 2: Double Card Edit', () => {
    it('should successfully edit a card twice in a row', async () => {
      testLog('Тест 2: Начало двойного редактирования');
      
      // Первое редактирование (уже сделано в тесте 1, но сделаем ещё раз для чистоты)
      const editRes1 = await request(BASE_URL)
        .post(`/api/card/update?username=${TEST_USERNAME}`)
        .send({
          oldQuestion: EDITED_QUESTION_1,
          newQuestion: EDITED_QUESTION_1 + '_v2',
          newAnswer: originalCardData?.answer || 'test answer'
        });
      
      testLog('Первое редактирование', {
        status: editRes1.status,
        ok: editRes1.body?.ok,
        debug: editRes1.body?.debug
      });
      
      expect(editRes1.status).toBe(200);
      expect(editRes1.body.ok).toBe(true);
      
      // Небольшая задержка
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Второе редактирование
      const editRes2 = await request(BASE_URL)
        .post(`/api/card/update?username=${TEST_USERNAME}`)
        .send({
          oldQuestion: EDITED_QUESTION_1 + '_v2',
          newQuestion: EDITED_QUESTION_2,
          newAnswer: originalCardData?.answer || 'test answer'
        });
      
      testLog('Второе редактирование', {
        status: editRes2.status,
        ok: editRes2.body?.ok,
        debug: editRes2.body?.debug,
        questionsInFile: editRes2.body?.debug?.questionsInFile?.slice(0, 3)
      });
      
      // Проверка ответа
      expect(editRes2.status).toBe(200);
      expect(editRes2.body.ok).toBe(true);
      expect(editRes2.body.debug?.cardFoundInFile).toBe(true);
      
      // Проверка файла
      const userData = readUserData(TEST_USERNAME);
      const card = assertCardExists(userData, EDITED_QUESTION_2, 'После второго редактирования');
      
      testLog('Тест 2: Успешно пройден', { 
        cardQuestion: card.question.substring(0, 50)
      });
    }, 10000);
  });
  
  /**
   * ТЕСТ 3: Перезапуск сервера
   */
  describe('Test 3: Server Restart', () => {
    it('should preserve card edits after server restart', async () => {
      testLog('Тест 3: Начало теста с перезапуском');
      
      // Хеш файла до перезапуска
      const hashBefore = getFileHash(`data/user_${TEST_USERNAME}.json`);
      testLog('Хеш файла до перезапуска', { hash: hashBefore?.substring(0, 50) });
      
      // Перезапустить сервер
      await restartServer(8085);
      
      // Проверка данных после перезапуска
      const userData = readUserData(TEST_USERNAME);
      const card = assertCardExists(userData, EDITED_QUESTION_2, 'После перезапуска сервера');
      
      const hashAfter = getFileHash(`data/user_${TEST_USERNAME}.json`);
      testLog('Хеш файла после перезапуска', { hash: hashAfter?.substring(0, 50) });
      
      expect(hashBefore).toBe(hashAfter);
      
      testLog('Тест 3: Успешно пройден');
    }, 60000);
  });
  
  /**
   * ТЕСТ 4: Выход/вход в аккаунт
   */
  describe('Test 4: Logout/Login', () => {
    it('should preserve card edits after logout and login', async () => {
      testLog('Тест 4: Начало теста с выходом/входом');
      
      // Logout (если есть такой эндпоинт)
      try {
        await request(BASE_URL)
          .post('/api/logout')
          .send({ username: TEST_USERNAME });
        testLog('Logout успешен');
      } catch (e) {
        testLog('Logout не реализован или ошибка', { error: e.message });
      }
      
      // Login снова
      const loginRes = await request(BASE_URL)
        .post('/api/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
      
      expect(loginRes.status).toBe(200);
      testLog('Login успешен');
      
      // Проверка данных
      const userData = readUserData(TEST_USERNAME);
      const card = assertCardExists(userData, EDITED_QUESTION_2, 'После logout/login');
      
      testLog('Тест 4: Успешно пройден', { 
        cardQuestion: card.question.substring(0, 50)
      });
    }, 10000);
  });
  
  /**
   * ТЕСТ 5: Восстановление оригинальных данных
   */
  describe('Test 5: Restore Original Data', () => {
    it('should restore original card data', async () => {
      testLog('Тест 5: Восстановление оригинальных данных');
      
      if (originalCardData) {
        const restoreRes = await request(BASE_URL)
          .post(`/api/card/update?username=${TEST_USERNAME}`)
          .send({
            oldQuestion: EDITED_QUESTION_2,
            newQuestion: ORIGINAL_QUESTION,
            newAnswer: originalCardData.answer
          });
        
        testLog('Восстановление данных', {
          status: restoreRes.status,
          ok: restoreRes.body?.ok
        });
        
        expect(restoreRes.status).toBe(200);
        
        const userData = readUserData(TEST_USERNAME);
        assertCardExists(userData, ORIGINAL_QUESTION, 'После восстановления');
        
        testLog('Тест 5: Успешно пройден');
      } else {
        testLog('Тест 5: Пропущен (нет оригинальных данных)');
      }
    }, 10000);
  });
  
});
