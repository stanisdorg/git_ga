export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/api/**/*.test.js'],
  verbose: true,
  testTimeout: 60000, // 60 секунд на тест (для перезапуска сервера)
  silent: false,
  testSequencer: './tests/sequencer.js' // Последовательный запуск тестов
};
