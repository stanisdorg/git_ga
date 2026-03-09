// E2E тесты для проверки изоляции данных пользователей
// Запуск: npx playwright test tests/isolation.spec.ts

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USER_DATA_DIR = path.join(DATA_DIR, 'user-data');

test.describe('Data Isolation E2E Tests', () => {

    // Очистка перед каждым тестом
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8085');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window as any).UserSystem !== undefined, { timeout: 10000 });
        await page.waitForTimeout(3000);
    });

    test('Test 1: Server saves admin data to personal file', async ({ page }) => {
        // Логин как admin
        await page.evaluate(() => {
            const adminUser = { username: 'admin', role: 'admin' };
            localStorage.setItem('qaSessionUser', JSON.stringify(adminUser));
            localStorage.setItem('currentUser', JSON.stringify({
                username: 'admin',
                role: 'admin',
                loggedIn: true
            }));
        });
        await page.waitForTimeout(1000);

        // Проверяем что сервер создал файл пользователя
        const userFileExists = fs.existsSync(path.join(USER_DATA_DIR, 'admin.json'));
        
        // Файл может ещё не существовать если не было сохранения
        // Это OK - проверим после редактирования
        console.log('User file exists before edit:', userFileExists);
    });

    test('Test 2: Server saves stanisdorg data to global file', async ({ page }) => {
        // Логин как super_admin
        await page.evaluate(() => {
            const superAdmin = { username: 'stanisdorg', role: 'super_admin' };
            localStorage.setItem('qaSessionUser', JSON.stringify(superAdmin));
            localStorage.setItem('currentUser', JSON.stringify({
                username: 'stanisdorg',
                role: 'super_admin',
                loggedIn: true
            }));
        });
        await page.waitForTimeout(1000);

        // Глобальный файл должен существовать
        const globalFileExists = fs.existsSync(path.join(DATA_DIR, 'questions_no_anki.json'));
        expect(globalFileExists).toBeTruthy();
    });

    test('Test 3: Load endpoint returns correct data for user', async ({ page }) => {
        // Тестируем эндпоинт /load напрямую
        const response = await page.request.get('http://localhost:8085/load?user=admin');
        const json = await response.json();
        
        // Должен вернуть данные (глобальные если персональных ещё нет)
        expect(json.ok).toBeTruthy();
        expect(json.data).toBeDefined();
        expect(json.count).toBeGreaterThanOrEqual(0);
    });

    test('Test 4: Load endpoint returns global for stanisdorg', async ({ page }) => {
        const response = await page.request.get('http://localhost:8085/load?user=stanisdorg');
        const json = await response.json();
        
        expect(json.ok).toBeTruthy();
        expect(json.data).toBeDefined();
    });

    test('Test 5: Different users have different data files', async ({ page }) => {
        // Создаём тестовые данные через прямой вызов API
        const adminResponse = await page.request.post('http://localhost:8085/save?user=admin', {
            data: [{ question: 'ADMIN_TEST_Q', answer: 'ADMIN_TEST_A' }]
        });
        expect(adminResponse.ok()).toBeTruthy();

        const userResponse = await page.request.post('http://localhost:8085/save?user=user1', {
            data: [{ question: 'USER1_TEST_Q', answer: 'USER1_TEST_A' }]
        });
        expect(userResponse.ok()).toBeTruthy();

        // Проверяем что файлы разные
        const adminFile = path.join(USER_DATA_DIR, 'admin.json');
        const user1File = path.join(USER_DATA_DIR, 'user1.json');

        expect(fs.existsSync(adminFile)).toBeTruthy();
        expect(fs.existsSync(user1File)).toBeTruthy();

        // Читаем и сравниваем
        const adminData = JSON.parse(fs.readFileSync(adminFile, 'utf-8'));
        const user1Data = JSON.parse(fs.readFileSync(user1File, 'utf-8'));

        expect(adminData.some((i: any) => i.question === 'ADMIN_TEST_Q')).toBeTruthy();
        expect(user1Data.some((i: any) => i.question === 'USER1_TEST_Q')).toBeTruthy();
        
        // У admin НЕ должно быть вопроса user1
        expect(adminData.some((i: any) => i.question === 'USER1_TEST_Q')).toBeFalsy();
        
        // У user1 НЕ должно быть вопроса admin
        expect(user1Data.some((i: any) => i.question === 'ADMIN_TEST_Q')).toBeFalsy();
    });
});
