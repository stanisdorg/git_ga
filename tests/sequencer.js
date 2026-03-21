// Последовательный запуск тестов (важно для тестов с перезапуском сервера)
import Sequencer from '@jest/test-sequencer';

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Запускать тесты по порядку (по имени файла)
    return tests.sort((testA, testB) => (testA.path > testB.path ? 1 : -1));
  }
}

export default CustomSequencer;
