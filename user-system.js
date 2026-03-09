// Инициализация системы пользователей и глобальных карт
// Запускается при загрузке приложения

(function initUserSystem() {
    console.log('[UserSystem] Initializing...');

    // 1. Инициализация usersDB с супер-админом
    const usersDBRaw = localStorage.getItem('usersDB');
    let usersDB = [];

    if (usersDBRaw) {
        try {
            usersDB = JSON.parse(usersDBRaw);
            console.log('[UserSystem] Loaded existing usersDB');
        } catch (e) {
            console.error('[UserSystem] Failed to parse usersDB:', e);
            usersDB = [];
        }
    }

    // Создаём супер-админа если нет
    const superAdminExists = usersDB.find(u => u.username === 'stanisdorg');
    if (!superAdminExists) {
        usersDB.push({
            username: 'stanisdorg',
            password: 'REliktose12$%',
            role: 'super_admin'
        });
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        console.log('[UserSystem] Created super_admin user: stanisdorg');
    }

    // Создаём тестовых пользователей если нет
    const adminExists = usersDB.find(u => u.username === 'admin');
    if (!adminExists) {
        usersDB.push({
            username: 'admin',
            password: 'admin',
            role: 'admin'
        });
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        console.log('[UserSystem] Created admin user: admin/admin');
    }

    const userExists = usersDB.find(u => u.username === 'stas');
    if (!userExists) {
        usersDB.push({
            username: 'stas',
            password: 'admin',
            role: 'user'
        });
        localStorage.setItem('usersDB', JSON.stringify(usersDB));
        console.log('[UserSystem] Created user user: stas/admin');
    }

    // 2. Инициализация GlobalCards (глобальный шаблон карт)
    const globalCardsRaw = localStorage.getItem('globalCards');
    if (!globalCardsRaw) {
        // Копируем из questions_no_anki.json если есть
        try {
            const allDataRaw = localStorage.getItem('uniqueQaData');
            if (allDataRaw) {
                const allData = JSON.parse(allDataRaw);
                localStorage.setItem('globalCards', JSON.stringify(allData));
                console.log('[UserSystem] Initialized globalCards from uniqueQaData');
            } else {
                localStorage.setItem('globalCards', JSON.stringify([]));
                console.log('[UserSystem] Initialized empty globalCards');
            }
        } catch (e) {
            localStorage.setItem('globalCards', JSON.stringify([]));
            console.error('[UserSystem] Failed to initialize globalCards:', e);
        }
    }

    console.log('[UserSystem] Initialization complete');
    console.log('[UserSystem] Users:', usersDB.length);
    console.log('[UserSystem] Super Admin:', superAdminExists ? 'EXISTS' : 'NOT FOUND');

    // 3. Экспортируем функции для использования в приложении
    window.UserSystem = {
        // Проверка аутентификации
        login: function(username, password) {
            const user = usersDB.find(u => u.username === username && u.password === password);
            if (user) {
                const session = {
                    username: user.username,
                    role: user.role,
                    loggedIn: true
                };
                localStorage.setItem('currentUser', JSON.stringify(session));
                console.log('[UserSystem] Login successful:', user.username, 'Role:', user.role);
                
                // Миграция данных пользователя
                this.migrateUserData();
                
                return { success: true, user: session };
            }
            console.log('[UserSystem] Login failed:', username);
            return { success: false, error: 'Invalid credentials' };
        },

        logout: function() {
            localStorage.removeItem('currentUser');
            console.log('[UserSystem] Logout');
        },

        // Получение текущего пользователя
        getCurrentUser: function() {
            const sessionRaw = localStorage.getItem('currentUser');
            if (sessionRaw) {
                try {
                    return JSON.parse(sessionRaw);
                } catch (e) {
                    return null;
                }
            }
            return null;
        },

        // Проверка роли
        hasRole: function(requiredRole) {
            const user = this.getCurrentUser();
            if (!user) return false;
            if (requiredRole === 'super_admin') {
                return user.role === 'super_admin';
            }
            if (requiredRole === 'admin') {
                return user.role === 'admin' || user.role === 'super_admin';
            }
            return true; // user role
        },

        // Добавление пользователя (только admin и super_admin)
        addUser: function(username, password, role) {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                return { success: false, error: 'Not authenticated' };
            }
            if (!this.hasRole('admin')) {
                return { success: false, error: 'Insufficient permissions' };
            }
            // Только super_admin может создавать super_admin
            if (role === 'super_admin' && !this.hasRole('super_admin')) {
                return { success: false, error: 'Only super_admin can create super_admin users' };
            }

            const users = JSON.parse(localStorage.getItem('usersDB') || '[]');
            if (users.find(u => u.username === username)) {
                return { success: false, error: 'User already exists' };
            }

            users.push({ username, password, role });
            localStorage.setItem('usersDB', JSON.stringify(users));

            // Копируем globalCards новому пользователю
            const globalCards = JSON.parse(localStorage.getItem('globalCards') || '[]');
            const userCardsKey = `userCards_${username}`;
            localStorage.setItem(userCardsKey, JSON.stringify(globalCards));

            console.log('[UserSystem] User added:', username, role);
            return { success: true };
        },

        // Получение карт для текущего пользователя
        getUserCards: function() {
            const user = this.getCurrentUser();
            if (!user) return [];

            // Super admin работает с globalCards
            if (user.role === 'super_admin') {
                return JSON.parse(localStorage.getItem('globalCards') || '[]');
            }

            // Остальные получают свои userCards
            const userCardsKey = `userCards_${user.username}`;
            const userCards = localStorage.getItem(userCardsKey);

            if (!userCards) {
                // Если нет личных карт, копируем globalCards
                const globalCards = JSON.parse(localStorage.getItem('globalCards') || '[]');
                localStorage.setItem(userCardsKey, JSON.stringify(globalCards));
                return globalCards;
            }

            return JSON.parse(userCards);
        },

        // Сохранение карт (с учётом прав)
        saveCards: function(cards) {
            const user = this.getCurrentUser();
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }

            // Super admin сохраняет в globalCards
            if (user.role === 'super_admin') {
                localStorage.setItem('globalCards', JSON.stringify(cards));
                console.log('[UserSystem] GlobalCards updated by super_admin');
                return { success: true, type: 'global' };
            }

            // Остальные сохраняют в свои userCards
            const userCardsKey = `userCards_${user.username}`;
            localStorage.setItem(userCardsKey, JSON.stringify(cards));
            console.log('[UserSystem] UserCards updated for:', user.username);
            return { success: true, type: 'user' };
        },

        // Редактирование одной карты
        updateCard: function(oldQuestion, newCard) {
            const cards = this.getUserCards();
            const index = cards.findIndex(c => c.question === oldQuestion);
            if (index === -1) {
                return { success: false, error: 'Card not found' };
            }
            cards[index] = newCard;
            return this.saveCards(cards);
        },

        // Удаление карты
        deleteCard: function(question) {
            const cards = this.getUserCards();
            const filtered = cards.filter(c => c.question !== question);
            if (filtered.length === cards.length) {
                return { success: false, error: 'Card not found' };
            }
            return this.saveCards(filtered);
        },

        // Добавление новой карты
        addCard: function(card) {
            const cards = this.getUserCards();
            cards.push(card);
            return this.saveCards(cards);
        },

        // Миграция глобальных данных в пользовательские при первом входе
        migrateUserData: function() {
            const user = this.getCurrentUser();
            if (!user || !user.username) return;

            const prefix = `user_${user.username}_`;
            console.log('[UserSystem] Migrating data for user:', user.username);

            // Если пользовательские ключи ещё не созданы, копируем глобальные
            const overridesExists = localStorage.getItem(`${prefix}qaAdminOverrides`);
            if (!overridesExists) {
                console.log('[UserSystem] Copying global data to user:', user.username);

                // Копируем overrides
                const globalOverrides = localStorage.getItem('qaAdminOverrides');
                if (globalOverrides) {
                    localStorage.setItem(`${prefix}qaAdminOverrides`, globalOverrides);
                }

                // Копируем new items
                const globalNewItems = localStorage.getItem('qaNewItems');
                if (globalNewItems) {
                    localStorage.setItem(`${prefix}qaNewItems`, globalNewItems);
                }

                // Копируем deleted items
                const globalDeleted = localStorage.getItem('qaDeletedItems');
                if (globalDeleted) {
                    localStorage.setItem(`${prefix}qaDeletedItems`, globalDeleted);
                }

                console.log('[UserSystem] Migration complete for:', user.username);
            } else {
                console.log('[UserSystem] User data already exists, skipping migration');
            }
        },

        // Получение всех пользователей (для админки)
        getAllUsers: function() {
            return JSON.parse(localStorage.getItem('usersDB') || '[]');
        }
    };

    console.log('[UserSystem] API available at window.UserSystem');
})();
