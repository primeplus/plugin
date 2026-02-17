(function() {
    'use strict';

    // ==========================================
    // LAMPA ONLINE PLUGIN - CLEAN IMPLEMENTATION
    // ==========================================
    // Version: 1.0.0
    // A fast, lightweight streaming plugin for Lampa
    // Supports: Kodik, HDVB, Filmix, Rezka, VideoCDN, Alloha
    // ==========================================

    // ==========================================
    // SECTION 1: CONFIGURATION SYSTEM
    // ==========================================

    const DEFAULTS = {
        kodik: {
            url: 'https://kodikapi.com',
            token: '41dd95f84c21719b09d6c71182237a25',
            enabled: true,
            priority: 1
        },
        videocdn: {
            url: 'https://videocdn.tv',
            token: '822Lv92DG3umkMddXZpuVT1lRehwIh16',
            enabled: false,  // DISABLED by default (blocked domain)
            priority: 3
        },
        hdvb: {
            url: 'https://hdvb.cc',
            token: '26857f5979203e91122a76203a743477',
            enabled: true,
            priority: 2
        },
        filmix: {
            url: 'http://filmixapp.cyou',
            token: '',  // User must provide
            enabled: false,  // Disabled without token
            priority: 4
        },
        rezka: {
            url: 'https://rezka.ag',
            enabled: true,
            priority: 5
        },
        alloha: {
            url: 'https://api.apbugall.org',
            token: '',
            enabled: false,  // Disabled without token
            priority: 6
        },
        collaps: {
            url: 'https://api.collaps.org',
            enabled: false,  // DISABLED (non-operational)
            priority: 7
        }
    };

    const Config = {
        get(balancer, key) {
            const storageKey = `online_${balancer}_${key}`;
            const stored = Lampa.Storage.get(storageKey, null);
            return stored !== null ? stored : DEFAULTS[balancer][key];
        },

        set(balancer, key, value) {
            const storageKey = `online_${balancer}_${key}`;
            Lampa.Storage.set(storageKey, value);
        },

        getUrl(balancer) {
            let url = this.get(balancer, 'url');
            return url.replace(/\/+$/, ''); // Remove trailing slash
        },

        getToken(balancer) {
            return this.get(balancer, 'token') || '';
        },

        isEnabled(balancer) {
            return this.get(balancer, 'enabled') === true;
        },

        getAllEnabled() {
            return Object.keys(DEFAULTS).filter(name => this.isEnabled(name));
        }
    };

    // ==========================================
    // SECTION 2: NETWORK LAYER
    // ==========================================

    const Network = {
        request(url, params = {}) {
            return new Promise((resolve, reject) => {
                const network = new Lampa.Reguest();

                const options = {
                    dataType: params.dataType || 'json',
                    timeout: params.timeout || 15000,
                    headers: params.headers || {}
                };

                if (params.data) {
                    options.data = params.data;
                }

                network.native(url, (response) => {
                    resolve(response);
                }, (error) => {
                    console.error('[Network] Error:', error);
                    reject(error);
                }, options);
            });
        },

        async get(url, params = {}) {
            return this.request(url, { ...params, method: 'GET' });
        },

        async post(url, data, params = {}) {
            return this.request(url, { ...params, method: 'POST', data });
        }
    };

    // ==========================================
    // SECTION 3: BALANCERS IMPLEMENTATION
    // ==========================================

    // Standardized result format:
    // {
    //     balancer: 'name',
    //     results: [
    //         {
    //             title: string,
    //             original_title: string,
    //             year: number,
    //             quality: string,
    //             translation: string,
    //             url: string,
    //             season: number | null,
    //             episodes: number | null
    //         }
    //     ],
    //     error: string | null
    // }

    async function searchKodik(object) {
        const url = Config.getUrl('kodik');
        const token = Config.getToken('kodik');

        if (!token) {
            return { balancer: 'kodik', results: [], error: 'Token required' };
        }

        try {
            let params = `?token=${token}&limit=100&with_material_data=true`;

            // Prefer Kinopoisk ID
            if (object.movie.kinopoisk_id) {
                params += `&kinopoisk_id=${encodeURIComponent(object.movie.kinopoisk_id)}`;
            } else if (object.movie.imdb_id) {
                params += `&imdb_id=${encodeURIComponent(object.movie.imdb_id)}`;
            } else {
                // Fallback to title search
                const title = object.search || object.movie.title;
                params += `&title=${encodeURIComponent(title)}`;
                if (object.search_date) {
                    params += `&year=${object.search_date}`;
                }
            }

            const response = await Network.get(`${url}/search${params}`);

            if (response && response.results && response.results.length > 0) {
                const results = response.results.map(item => ({
                    title: item.title || '',
                    original_title: item.title_orig || '',
                    year: item.year || null,
                    quality: item.quality || 'Unknown',
                    translation: item.translation?.title || 'Unknown',
                    url: item.link || '',
                    season: item.seasons ? Object.keys(item.seasons).length : null,
                    episodes: item.episodes_count || null,
                    kp_id: item.kinopoisk_id,
                    imdb_id: item.imdb_id
                }));

                return { balancer: 'kodik', results, error: null };
            } else {
                return { balancer: 'kodik', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[Kodik] Error:', error);
            return { balancer: 'kodik', results: [], error: 'Network error' };
        }
    }

    async function searchHDVB(object) {
        const url = Config.getUrl('hdvb');
        const token = Config.getToken('hdvb');

        if (!token) {
            return { balancer: 'hdvb', results: [], error: 'Token required' };
        }

        try {
            let params = `?token=${token}`;

            if (object.movie.kinopoisk_id) {
                params += `&id_kp=${object.movie.kinopoisk_id}`;
            } else {
                const title = object.search || object.movie.title;
                params += `&title=${encodeURIComponent(title)}`;
            }

            const response = await Network.get(`${url}/api/videos.json${params}`);

            if (response && response.success && response.data) {
                const results = response.data.map(item => ({
                    title: item.title || '',
                    quality: item.quality || 'Unknown',
                    translation: item.translation || 'Unknown',
                    url: item.link || item.iframe_url || '',
                    season: item.season || null,
                    episodes: item.episodes || null
                }));

                return { balancer: 'hdvb', results, error: null };
            } else {
                return { balancer: 'hdvb', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[HDVB] Error:', error);
            return { balancer: 'hdvb', results: [], error: 'Network error' };
        }
    }

    async function searchFilmix(object) {
        const url = Config.getUrl('filmix');
        const token = Config.getToken('filmix');

        if (!token) {
            return { balancer: 'filmix', results: [], error: 'User token required (get from Filmix PRO)' };
        }

        try {
            const title = object.search || object.movie.title;
            const searchUrl = `${url}/api/v2/search`;

            const params = new URLSearchParams({
                user_dev_token: token,
                name: title
            });

            const headers = {
                'User-Agent': 'Filmix/2.1.1 (Android; SDK 29; en_US)'
            };

            const response = await Network.get(`${searchUrl}?${params}`, { headers });

            if (response && Array.isArray(response) && response.length > 0) {
                const results = response.map(item => ({
                    title: item.title || '',
                    original_title: item.original_title || '',
                    year: item.year || null,
                    quality: 'Up to 1080p',
                    translation: 'Original',
                    url: `${url}/post/${item.id}`,
                    season: item.last_episode?.season || null,
                    episodes: item.last_episode?.episode || null
                }));

                return { balancer: 'filmix', results, error: null };
            } else {
                return { balancer: 'filmix', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[Filmix] Error:', error);
            return { balancer: 'filmix', results: [], error: 'Network error' };
        }
    }

    async function searchRezka(object) {
        const url = Config.getUrl('rezka');

        try {
            const title = object.search || object.movie.title;
            const searchUrl = `${url}/search/?q=${encodeURIComponent(title)}`;

            const response = await Network.get(searchUrl, { dataType: 'text' });

            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(response, 'text/html');
            const items = doc.querySelectorAll('.b-content__inline_item');

            const results = [];
            items.forEach(item => {
                const link = item.querySelector('a');
                const titleEl = item.querySelector('.b-content__inline_item-link');

                if (link && titleEl) {
                    const infoDiv = item.querySelector('.b-content__inline_item-features');
                    let quality = 'Unknown';

                    if (infoDiv) {
                        const qualityText = infoDiv.textContent;
                        if (qualityText.includes('4K')) quality = '4K';
                        else if (qualityText.includes('1080')) quality = '1080p';
                        else if (qualityText.includes('720')) quality = '720p';
                    }

                    results.push({
                        title: titleEl.textContent.trim(),
                        url: link.href,
                        quality: quality,
                        translation: 'Original'
                    });
                }
            });

            if (results.length > 0) {
                return { balancer: 'rezka', results, error: null };
            } else {
                return { balancer: 'rezka', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[Rezka] Error:', error);
            return { balancer: 'rezka', results: [], error: 'Network error (try changing mirror in settings)' };
        }
    }

    async function searchVideoCDN(object) {
        const url = Config.getUrl('videocdn');
        const token = Config.getToken('videocdn');

        if (!token) {
            return { balancer: 'videocdn', results: [], error: 'Token required' };
        }

        try {
            let params = `?api_token=${token}`;

            if (object.movie.kinopoisk_id) {
                params += `&kinopoisk_id=${object.movie.kinopoisk_id}`;
            } else {
                const title = object.search || object.movie.title;
                params += `&title=${encodeURIComponent(title)}`;
            }

            const response = await Network.get(`${url}/api/short${params}`, { timeout: 10000 });

            if (response && response.data && response.data.length > 0) {
                const results = response.data.map(item => ({
                    title: item.title || '',
                    original_title: item.title_orig || '',
                    quality: item.quality || 'Unknown',
                    translation: item.translation?.title || 'Unknown',
                    url: item.iframe || '',
                    season: item.season_count || null,
                    episodes: item.episode_count || null
                }));

                return { balancer: 'videocdn', results, error: null };
            } else {
                return { balancer: 'videocdn', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[VideoCDN] Error (likely blocked):', error);
            return {
                balancer: 'videocdn',
                results: [],
                error: 'Blocked/SSL error - try changing domain in settings'
            };
        }
    }

    async function searchAlloha(object) {
        const url = Config.getUrl('alloha');
        const token = Config.getToken('alloha');

        if (!token) {
            return { balancer: 'alloha', results: [], error: 'Token required' };
        }

        try {
            let params = `?token=${token}`;

            if (object.movie.kinopoisk_id) {
                params += `&kp=${object.movie.kinopoisk_id}`;
            } else if (object.movie.imdb_id) {
                params += `&imdb=${object.movie.imdb_id}`;
            } else {
                return { balancer: 'alloha', results: [], error: 'Kinopoisk ID or IMDB ID required' };
            }

            const response = await Network.get(`${url}/${params}`);

            if (response && response.data && response.data.iframe) {
                const results = [{
                    title: object.movie.title || 'Unknown',
                    quality: 'Unknown',
                    translation: 'Original',
                    url: response.data.iframe
                }];

                return { balancer: 'alloha', results, error: null };
            } else {
                return { balancer: 'alloha', results: [], error: 'No results' };
            }
        } catch (error) {
            console.warn('[Alloha] Error:', error);
            return { balancer: 'alloha', results: [], error: 'Network error' };
        }
    }

    // ==========================================
    // SECTION 4: SEARCH CONTROLLER
    // ==========================================

    let component = {
        create: function() {
            let _this = this;

            this.activity = new Lampa.Activity({
                url: '',
                component: 'online',
                onBack: function() {
                    _this.activity.estroy();
                },
                onRender: function() {
                    _this.startSearch();
                }
            });

            return this.activity;
        },

        startSearch: function() {
            const object = this.activity.movie || this.activity;

            if (!object) {
                this.empty('No movie data');
                return;
            }

            this.loading(true);

            // Get all enabled balancers
            const enabledBalancers = Config.getAllEnabled();

            if (enabledBalancers.length === 0) {
                this.loading(false);
                this.empty('No balancers enabled. Check settings.');
                return;
            }

            console.log('[Online] Searching balancers:', enabledBalancers);

            // Create search promises for all enabled balancers
            const searchPromises = enabledBalancers.map(name => {
                switch(name) {
                    case 'kodik': return searchKodik(object);
                    case 'hdvb': return searchHDVB(object);
                    case 'filmix': return searchFilmix(object);
                    case 'rezka': return searchRezka(object);
                    case 'videocdn': return searchVideoCDN(object);
                    case 'alloha': return searchAlloha(object);
                    default: return Promise.resolve({ balancer: name, results: [], error: 'Unknown balancer' });
                }
            });

            // Execute all searches simultaneously
            const self = this;
            Promise.allSettled(searchPromises).then(function(results) {
                // Process results
                const successfulResults = [];
                const errors = [];

                results.forEach(function(result) {
                    if (result.status === 'fulfilled') {
                        if (result.value.results && result.value.results.length > 0) {
                            successfulResults.push({
                                balancer: result.value.balancer,
                                results: result.value.results
                            });
                        }
                        if (result.value.error) {
                            errors.push(result.value.balancer + ': ' + result.value.error);
                        }
                    } else {
                        console.error('[Search] Promise rejected:', result.reason);
                        errors.push('Unknown error occurred');
                    }
                });

                self.loading(false);

                // Display results or errors
                if (successfulResults.length > 0) {
                    self.displayResults(successfulResults, object);
                } else {
                    const errorMsg = errors.length > 0
                        ? errors.join('\n')
                        : 'No results found';
                    self.empty(errorMsg);
                }
            });
        },

        loading: function(show) {
            if (show) {
                const empty = new Lampa.Empty({
                    title: 'Searching...',
                    descr: 'Please wait...'
                });
                this.activity.render().html(empty.render());
            }
        },

        empty: function(message) {
            const empty = new Lampa.Empty({
                title: 'No Results',
                descr: message
            });
            this.activity.render().html(empty.render());
        },

        displayResults: function(results, object) {
            // Flatten and sort results by priority
            const allItems = [];

            results.forEach(function(data) {
                data.results.forEach(function(item) {
                    allItems.push({
                        ...item,
                        balancer: data.balancer,
                        priority: DEFAULTS[data.balancer].priority
                    });
                });
            });

            // Sort by priority
            allItems.sort(function(a, b) {
                return a.priority - b.priority;
            });

            console.log('[Online] Displaying', allItems.length, 'results');

            // Create scroll container
            const scroll = new Lampa.Scroll({
                step: 200,
                horizontal: false
            });

            // Create result cards
            allItems.forEach(function(item) {
                const card = this.createResultCard(item, object);
                scroll.append(card);
            }, this);

            // Append to activity
            this.activity.render().html(scroll.render());
        },

        createResultCard: function(item, object) {
            const card = $(`
                <div class="selector online-result">
                    <div class="online-result__title">${item.title}</div>
                    <div class="online-result__info">
                        <span class="online-result__balancer">${item.balancer.toUpperCase()}</span>
                        <span class="online-result__quality">${item.quality}</span>
                        ${item.translation ? `<span class="online-result__translation">${item.translation}</span>` : ''}
                        ${item.season ? `<span class="online-result__season">S${item.season}</span>` : ''}
                    </div>
                </div>
            `);

            const self = this;
            card.on('hover:enter', function() {
                self.playVideo(item, object);
            });

            return card;
        },

        playVideo: function(item, object) {
            const streamUrl = item.url;

            // Check if it's an embed link that needs extraction
            if (streamUrl.includes('/embed/') || streamUrl.includes('iframe')) {
                Lampa.Noty.show('Opening: ' + item.title);

                // For now, just open in external browser
                // In a full implementation, you would extract the actual stream URL
                window.open(streamUrl, '_blank');
            } else {
                // Direct stream URL
                Lampa.Player.play({
                    url: streamUrl,
                    title: item.title,
                    quality: item.quality
                });
            }
        }
    };

    // ==========================================
    // SECTION 5: UI INTEGRATION
    // ==========================================

    function initUI() {
        // Create button template
        const button = `
            <div class="full-start__button selector view--online" data-subtitle="online 1.0.0">
                <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 244 260">
                    <g>
                        <path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z" fill="currentColor"/>
                    </g>
                </svg>
                <span>Watch Online</span>
            </div>
        `;

        // Listen for full card render
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                const btn = $(button);

                btn.on('hover:enter', function() {
                    startSearch(e.data.movie || e.data);
                });

                // Insert after torrent button
                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });
    }

    // ==========================================
    // SECTION 6: SETTINGS UI
    // ==========================================

    function initSettings() {
        // Create settings template
        const template = createSettingsTemplate();
        Lampa.Template.add('settings_online', template);

        // Add to main settings menu
        if (Lampa.Settings.main && Lampa.Settings.main()) {
            const field = $(`
                <div class="settings-folder selector" data-component="online">
                    <div class="settings-folder__icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 244 260">
                            <g>
                                <path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88z" fill="currentColor"/>
                            </g>
                        </svg>
                    </div>
                    <div class="settings-folder__name">Online Sources</div>
                </div>
            `);

            Lampa.Settings.main().render().find('[data-component="more"]').before(field);
            Lampa.Settings.main().update();
        }

        // Bind events when online settings open
        Lampa.Settings.listener.follow('open', function(e) {
            if (e.name == 'online') {
                bindSettingsEvents(e.body);
            }
        });
    }

    function createSettingsTemplate() {
        let html = '<div class="settings-online">';

        // Add each balancer
        Object.keys(DEFAULTS).forEach(function(name) {
            const config = DEFAULTS[name];

            html += `
                <div class="settings-param selector" data-name="online_${name}_expand" data-static="true">
                    <div class="settings-param__name">${name.toUpperCase()}</div>
                    <div class="settings-param__value">${config.enabled ? 'ON' : 'OFF'}</div>
                </div>

                <div class="settings-online__details hidden" data-balancer="${name}">
                    <div class="settings-param selector" data-name="online_${name}_enabled" data-type="toggle" data-default="${config.enabled}">
                        <div class="settings-param__name">Enabled</div>
                        <div class="settings-param__value"></div>
                    </div>

                    <div class="settings-param selector" data-name="online_${name}_url" data-type="input" data-default="${config.url}">
                        <div class="settings-param__name">URL</div>
                        <div class="settings-param__value">${config.url}</div>
                    </div>
            `;

            if (config.token !== undefined) {
                html += `
                    <div class="settings-param selector" data-name="online_${name}_token" data-type="input" data-string="true" data-default="${config.token}">
                        <div class="settings-param__name">Token</div>
                        <div class="settings-param__value">${config.token ? '••••••' : 'Not set'}</div>
                    </div>
                `;
            }

            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    function bindSettingsEvents(body) {
        // Toggle balancer details
        body.find('[data-name$="_expand"]').on('hover:enter', function() {
            const name = $(this).data('name').replace('online_', '').replace('_expand', '');
            body.find('[data-balancer="' + name + '"]').toggleClass('hidden');
        });

        // Handle toggles
        body.find('[data-type="toggle"]').on('hover:enter', function() {
            const param = $(this).data('name');
            const defaultVal = $(this).data('default');
            const currentValue = Lampa.Storage.get(param, defaultVal);
            const newValue = !currentValue;

            Lampa.Storage.set(param, newValue);

            $(this).find('.settings-param__value').text(newValue ? 'ON' : 'OFF');

            // Update expand button status
            const balancerName = param.replace('online_', '').replace('_enabled', '');
            body.find('[data-name="online_' + balancerName + '_expand"]')
                .find('.settings-param__value')
                .text(newValue ? 'ON' : 'OFF');

            Lampa.Noty.show('Setting saved');
        });

        // Handle inputs
        body.find('[data-type="input"]').on('hover:enter', function() {
            const param = $(this).data('name');
            const defaultVal = $(this).data('default');
            const currentValue = Lampa.Storage.get(param, defaultVal);
            const isString = $(this).data('string');
            const self = $(this);

            Lampa.Keyboard.input({
                title: $(this).find('.settings-param__name').text(),
                value: currentValue,
                nosave: true
            }, function(new_value) {
                if (new_value !== null) {
                    Lampa.Storage.set(param, new_value);

                    const displayValue = isString && new_value
                        ? '••••••'
                        : (new_value.length > 30 ? new_value.substring(0, 30) + '...' : new_value);

                    self.find('.settings-param__value').text(displayValue || 'Not set');

                    Lampa.Noty.show('Setting saved');
                }
            });
        });
    }

    // ==========================================
    // SECTION 7: INITIALIZATION
    // ==========================================

    function init() {
        console.log('[Online] Initializing plugin...');

        // Register component (needed for Lampa.Activity.push)
        Lampa.Component.add('online', component);

        // Register manifest for context menu
        const manifest = {
            type: 'video',
            version: '1.0.0',
            name: 'Watch Online',
            description: 'Stream movies and shows from multiple sources',
            component: 'online',
            onContextMenu: function(object) {
                return {
                    name: 'Watch Online',
                    description: ''
                };
            },
            onContextLauch: function(object) {
                startSearch(object);
            }
        };

        Lampa.Manifest.plugins = manifest;

        // Initialize settings UI
        initSettings();

        // Initialize main UI
        initUI();

        console.log('[Online] Plugin initialized successfully');
    }

    function startSearch(object) {
        // Create activity for the search
        Lampa.Activity.push({
            url: '',
            title: 'Watch Online',
            component: 'online',
            search: object.title || object.name,
            search_one: object.title || object.name,
            search_two: object.original_title || '',
            movie: object,
            page: 1
        });
    }

    // Start plugin when Lampa is ready
    if (typeof Lampa !== 'undefined') {
        init();
    } else {
        console.error('[Online] Lampa is not defined');
    }

})();
