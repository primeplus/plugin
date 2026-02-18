//17.02.2026 - Clean Implementation

(function () {
    'use strict';

    var mod_version = '1.0.0';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    var DEFAULTS = {
        kodik: {
            url: 'https://kodikapi.com',
            token: '41dd95f84c21719b09d6c71182237a25',
            enabled: true,
            priority: 1
        },
        videocdn: {
            url: 'https://videocdn.tv',
            token: '822Lv92DG3umkMddXZpuVT1lRehwIh16',
            enabled: false,
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
            token: '',
            enabled: false,
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
            enabled: false,
            priority: 6
        },
        collaps: {
            url: 'https://api.collaps.org',
            enabled: false,
            priority: 7
        }
    };

    var Config = {
        get: function(balancer, key) {
            var storageKey = 'online_' + balancer + '_' + key;
            var stored = Lampa.Storage.get(storageKey, null);
            return stored !== null ? stored : DEFAULTS[balancer][key];
        },

        set: function(balancer, key, value) {
            var storageKey = 'online_' + balancer + '_' + key;
            Lampa.Storage.set(storageKey, value);
        },

        getUrl: function(balancer) {
            var url = this.get(balancer, 'url');
            return url.replace(/\/+$/, '');
        },

        getToken: function(balancer) {
            return this.get(balancer, 'token') || '';
        },

        isEnabled: function(balancer) {
            return this.get(balancer, 'enabled') === true;
        },

        getAllEnabled: function() {
            return Object.keys(DEFAULTS).filter(function(name) {
                return this.isEnabled(name);
            }.bind(this));
        }
    };

    // ==========================================
    // NETWORK LAYER
    // ==========================================

    var network = new Lampa.Reguest();

    function makeRequest(url, params) {
        return new Promise(function(resolve, reject) {
            var options = {
                dataType: params.dataType || 'json',
                timeout: params.timeout || 15000,
                headers: params.headers || {}
            };

            if (params.data) {
                options.data = params.data;
            }

            network.native(url, resolve, reject, options);
        });
    }

    // ==========================================
    // BALANCERS
    // ==========================================

    function searchKodik(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('kodik');
            var token = Config.getToken('kodik');

            if (!token) {
                resolve({ balancer: 'kodik', results: [], error: 'Token required' });
                return;
            }

            var params = '?token=' + token + '&limit=100&with_material_data=true';

            if (object.movie.kinopoisk_id) {
                params += '&kinopoisk_id=' + encodeURIComponent(object.movie.kinopoisk_id);
            } else if (object.movie.imdb_id) {
                params += '&imdb_id=' + encodeURIComponent(object.movie.imdb_id);
            } else {
                var title = object.search || object.movie.title;
                params += '&title=' + encodeURIComponent(title);
                if (object.search_date) {
                    params += '&year=' + object.search_date;
                }
            }

            makeRequest(url + '/search' + params, {})
                .then(function(response) {
                    if (response && response.results && response.results.length > 0) {
                        var results = response.results.map(function(item) {
                            return {
                                title: item.title || '',
                                original_title: item.title_orig || '',
                                year: item.year || null,
                                quality: item.quality || 'Unknown',
                                translation: item.translation ? item.translation.title : 'Unknown',
                                url: item.link || '',
                                season: item.seasons ? Object.keys(item.seasons).length : null,
                                episodes: item.episodes_count || null,
                                kp_id: item.kinopoisk_id,
                                imdb_id: item.imdb_id
                            };
                        });
                        resolve({ balancer: 'kodik', results: results, error: null });
                    } else {
                        resolve({ balancer: 'kodik', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[Kodik] Error:', error);
                    resolve({ balancer: 'kodik', results: [], error: 'Network error' });
                });
        });
    }

    function searchHDVB(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('hdvb');
            var token = Config.getToken('hdvb');

            if (!token) {
                resolve({ balancer: 'hdvb', results: [], error: 'Token required' });
                return;
            }

            var params = '?token=' + token;

            if (object.movie.kinopoisk_id) {
                params += '&id_kp=' + object.movie.kinopoisk_id;
            } else {
                var title = object.search || object.movie.title;
                params += '&title=' + encodeURIComponent(title);
            }

            makeRequest(url + '/api/videos.json' + params, {})
                .then(function(response) {
                    if (response && response.success && response.data) {
                        var results = response.data.map(function(item) {
                            return {
                                title: item.title || '',
                                quality: item.quality || 'Unknown',
                                translation: item.translation || 'Unknown',
                                url: item.link || item.iframe_url || '',
                                season: item.season || null,
                                episodes: item.episodes || null
                            };
                        });
                        resolve({ balancer: 'hdvb', results: results, error: null });
                    } else {
                        resolve({ balancer: 'hdvb', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[HDVB] Error:', error);
                    resolve({ balancer: 'hdvb', results: [], error: 'Network error' });
                });
        });
    }

    function searchFilmix(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('filmix');
            var token = Config.getToken('filmix');

            if (!token) {
                resolve({ balancer: 'filmix', results: [], error: 'User token required' });
                return;
            }

            var title = object.search || object.movie.title;
            var searchUrl = url + '/api/v2/search';

            var params = 'user_dev_token=' + token + '&name=' + encodeURIComponent(title);
            var headers = {
                'User-Agent': 'Filmix/2.1.1 (Android; SDK 29; en_US)'
            };

            makeRequest(searchUrl + '?' + params, { headers: headers })
                .then(function(response) {
                    if (response && Array.isArray(response) && response.length > 0) {
                        var results = response.map(function(item) {
                            return {
                                title: item.title || '',
                                original_title: item.original_title || '',
                                year: item.year || null,
                                quality: 'Up to 1080p',
                                translation: 'Original',
                                url: url + '/post/' + item.id,
                                season: item.last_episode ? item.last_episode.season : null,
                                episodes: item.last_episode ? item.last_episode.episode : null
                            };
                        });
                        resolve({ balancer: 'filmix', results: results, error: null });
                    } else {
                        resolve({ balancer: 'filmix', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[Filmix] Error:', error);
                    resolve({ balancer: 'filmix', results: [], error: 'Network error' });
                });
        });
    }

    function searchRezka(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('rezka');
            var title = object.search || object.movie.title;
            var searchUrl = url + '/search/?q=' + encodeURIComponent(title);

            makeRequest(searchUrl, { dataType: 'text' })
                .then(function(response) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(response, 'text/html');
                    var items = doc.querySelectorAll('.b-content__inline_item');

                    var results = [];
                    items.forEach(function(item) {
                        var link = item.querySelector('a');
                        var titleEl = item.querySelector('.b-content__inline_item-link');

                        if (link && titleEl) {
                            var infoDiv = item.querySelector('.b-content__inline_item-features');
                            var quality = 'Unknown';

                            if (infoDiv) {
                                var qualityText = infoDiv.textContent;
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
                        resolve({ balancer: 'rezka', results: results, error: null });
                    } else {
                        resolve({ balancer: 'rezka', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[Rezka] Error:', error);
                    resolve({ balancer: 'rezka', results: [], error: 'Network error' });
                });
        });
    }

    function searchVideoCDN(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('videocdn');
            var token = Config.getToken('videocdn');

            if (!token) {
                resolve({ balancer: 'videocdn', results: [], error: 'Token required' });
                return;
            }

            var params = '?api_token=' + token;

            if (object.movie.kinopoisk_id) {
                params += '&kinopoisk_id=' + object.movie.kinopoisk_id;
            } else {
                var title = object.search || object.movie.title;
                params += '&title=' + encodeURIComponent(title);
            }

            makeRequest(url + '/api/short' + params, { timeout: 10000 })
                .then(function(response) {
                    if (response && response.data && response.data.length > 0) {
                        var results = response.data.map(function(item) {
                            return {
                                title: item.title || '',
                                original_title: item.title_orig || '',
                                quality: item.quality || 'Unknown',
                                translation: item.translation ? item.translation.title : 'Unknown',
                                url: item.iframe || '',
                                season: item.season_count || null,
                                episodes: item.episode_count || null
                            };
                        });
                        resolve({ balancer: 'videocdn', results: results, error: null });
                    } else {
                        resolve({ balancer: 'videocdn', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[VideoCDN] Error:', error);
                    resolve({ balancer: 'videocdn', results: [], error: 'Network error' });
                });
        });
    }

    function searchAlloha(object) {
        return new Promise(function(resolve) {
            var url = Config.getUrl('alloha');
            var token = Config.getToken('alloha');

            if (!token) {
                resolve({ balancer: 'alloha', results: [], error: 'Token required' });
                return;
            }

            var params = '?token=' + token;

            if (object.movie.kinopoisk_id) {
                params += '&kp=' + object.movie.kinopoisk_id;
            } else if (object.movie.imdb_id) {
                params += '&imdb=' + object.movie.imdb_id;
            } else {
                resolve({ balancer: 'alloha', results: [], error: 'KP ID or IMDB ID required' });
                return;
            }

            makeRequest(url + '/' + params, {})
                .then(function(response) {
                    if (response && response.data && response.data.iframe) {
                        var results = [{
                            title: object.movie.title || 'Unknown',
                            quality: 'Unknown',
                            translation: 'Original',
                            url: response.data.iframe
                        }];
                        resolve({ balancer: 'alloha', results: results, error: null });
                    } else {
                        resolve({ balancer: 'alloha', results: [], error: 'No results' });
                    }
                })
                .catch(function(error) {
                    console.warn('[Alloha] Error:', error);
                    resolve({ balancer: 'alloha', results: [], error: 'Network error' });
                });
        });
    }

    // ==========================================
    // COMPONENT
    // ==========================================

    var component = {
        create: function() {
            var _this = this;

            this.activity = new Lampa.Activity({
                url: '',
                component: 'online',
                onBack: function() {
                    _this.activity.destroy();
                },
                onRender: function() {
                    _this.startSearch();
                }
            });

            return this.activity;
        },

        startSearch: function() {
            var object = this.activity.movie || this.activity;

            if (!object) {
                this.empty('No movie data');
                return;
            }

            this.loading(true);

            var enabledBalancers = Config.getAllEnabled();

            if (enabledBalancers.length === 0) {
                this.loading(false);
                this.empty('No balancers enabled. Check settings.');
                return;
            }

            console.log('[Online] Searching balancers:', enabledBalancers);

            var searchPromises = enabledBalancers.map(function(name) {
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

            var self = this;
            Promise.allSettled(searchPromises).then(function(results) {
                var successfulResults = [];
                var errors = [];

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

                if (successfulResults.length > 0) {
                    self.displayResults(successfulResults, object);
                } else {
                    var errorMsg = errors.length > 0 ? errors.join('\n') : 'No results found';
                    self.empty(errorMsg);
                }
            });
        },

        loading: function(show) {
            if (show) {
                var empty = new Lampa.Empty({
                    title: 'Searching...',
                    descr: 'Please wait...'
                });
                this.activity.render().html(empty.render());
            }
        },

        empty: function(message) {
            var empty = new Lampa.Empty({
                title: 'No Results',
                descr: message
            });
            this.activity.render().html(empty.render());
        },

        displayResults: function(results, object) {
            var allItems = [];

            results.forEach(function(data) {
                data.results.forEach(function(item) {
                    allItems.push({
                        title: item.title,
                        original_title: item.original_title,
                        year: item.year,
                        quality: item.quality,
                        translation: item.translation,
                        url: item.url,
                        season: item.season,
                        episodes: item.episodes,
                        balancer: data.balancer,
                        priority: DEFAULTS[data.balancer].priority
                    });
                });
            });

            allItems.sort(function(a, b) {
                return a.priority - b.priority;
            });

            console.log('[Online] Displaying', allItems.length, 'results');

            var scroll = new Lampa.Scroll({
                step: 200,
                horizontal: false
            });

            var self = this;
            allItems.forEach(function(item) {
                var card = self.createResultCard(item, object);
                scroll.append(card);
            });

            this.activity.render().html(scroll.render());
        },

        createResultCard: function(item, object) {
            var html = '<div class="selector online-result">' +
                '<div class="online-result__title">' + item.title + '</div>' +
                '<div class="online-result__info">' +
                '<span class="online-result__balancer">' + item.balancer.toUpperCase() + '</span>' +
                '<span class="online-result__quality">' + item.quality + '</span>';

            if (item.translation) {
                html += '<span class="online-result__translation">' + item.translation + '</span>';
            }
            if (item.season) {
                html += '<span class="online-result__season">S' + item.season + '</span>';
            }

            html += '</div></div>';

            var card = $(html);
            var self = this;

            card.on('hover:enter', function() {
                self.playVideo(item, object);
            });

            return card;
        },

        playVideo: function(item, object) {
            var streamUrl = item.url;

            if (streamUrl.includes('/embed/') || streamUrl.includes('iframe')) {
                Lampa.Noty.show('Opening: ' + item.title);
                window.open(streamUrl, '_blank');
            } else {
                Lampa.Player.play({
                    url: streamUrl,
                    title: item.title,
                    quality: item.quality
                });
            }
        }
    };

    // ==========================================
    // SETTINGS
    // ==========================================

    function initSettings() {
        var template = createSettingsTemplate();
        Lampa.Template.add('settings_online', template);

        if (Lampa.Settings.main && Lampa.Settings.main()) {
            var field = $('<div class="settings-folder selector" data-component="online">' +
                '<div class="settings-folder__icon">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 244 260">' +
                '<g><path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88z" fill="currentColor"/></g>' +
                '</svg></div>' +
                '<div class="settings-folder__name">Online Sources</div></div>');

            Lampa.Settings.main().render().find('[data-component="more"]').before(field);
            Lampa.Settings.main().update();
        }

        Lampa.Settings.listener.follow('open', function(e) {
            if (e.name == 'online') {
                bindSettingsEvents(e.body);
            }
        });
    }

    function createSettingsTemplate() {
        var html = '<div class="settings-online">';

        Object.keys(DEFAULTS).forEach(function(name) {
            var config = DEFAULTS[name];

            html += '<div class="settings-param selector" data-name="online_' + name + '_expand" data-static="true">' +
                '<div class="settings-param__name">' + name.toUpperCase() + '</div>' +
                '<div class="settings-param__value">' + (config.enabled ? 'ON' : 'OFF') + '</div></div>' +
                '<div class="settings-online__details hidden" data-balancer="' + name + '">' +
                '<div class="settings-param selector" data-name="online_' + name + '_enabled" data-type="toggle" data-default="' + config.enabled + '">' +
                '<div class="settings-param__name">Enabled</div>' +
                '<div class="settings-param__value"></div></div>' +
                '<div class="settings-param selector" data-name="online_' + name + '_url" data-type="input" data-default="' + config.url + '">' +
                '<div class="settings-param__name">URL</div>' +
                '<div class="settings-param__value">' + config.url + '</div></div>';

            if (config.token !== undefined) {
                html += '<div class="settings-param selector" data-name="online_' + name + '_token" data-type="input" data-string="true" data-default="' + config.token + '">' +
                    '<div class="settings-param__name">Token</div>' +
                    '<div class="settings-param__value">' + (config.token ? '••••••' : 'Not set') + '</div></div>';
            }

            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    function bindSettingsEvents(body) {
        body.find('[data-name$="_expand"]').on('hover:enter', function() {
            var name = $(this).data('name').replace('online_', '').replace('_expand', '');
            body.find('[data-balancer="' + name + '"]').toggleClass('hidden');
        });

        body.find('[data-type="toggle"]').on('hover:enter', function() {
            var param = $(this).data('name');
            var defaultVal = $(this).data('default');
            var currentValue = Lampa.Storage.get(param, defaultVal);
            var newValue = !currentValue;

            Lampa.Storage.set(param, newValue);
            $(this).find('.settings-param__value').text(newValue ? 'ON' : 'OFF');

            var balancerName = param.replace('online_', '').replace('_enabled', '');
            body.find('[data-name="online_' + balancerName + '_expand"]')
                .find('.settings-param__value')
                .text(newValue ? 'ON' : 'OFF');

            Lampa.Noty.show('Setting saved');
        });

        body.find('[data-type="input"]').on('hover:enter', function() {
            var param = $(this).data('name');
            var defaultVal = $(this).data('default');
            var currentValue = Lampa.Storage.get(param, defaultVal);
            var isString = $(this).data('string');
            var self = $(this);

            Lampa.Keyboard.input({
                title: $(this).find('.settings-param__name').text(),
                value: currentValue,
                nosave: true
            }, function(new_value) {
                if (new_value !== null) {
                    Lampa.Storage.set(param, new_value);
                    var displayValue = isString && new_value ? '••••••' :
                        (new_value.length > 30 ? new_value.substring(0, 30) + '...' : new_value);
                    self.find('.settings-param__value').text(displayValue || 'Not set');
                    Lampa.Noty.show('Setting saved');
                }
            });
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function startSearch(object) {
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

    function initMain() {
        Lampa.Component.add('online', component);

        var manifest = {
            type: 'video',
            version: mod_version,
            name: 'Watch Online - ' + mod_version,
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

        var button = '<div class="full-start__button selector view--online" data-subtitle="online ' + mod_version + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 244 260">' +
            '<g><path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88z" fill="currentColor"/></g>' +
            '</svg><span>Watch Online</span></div>';

        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                var btn = $(button);
                btn.on('hover:enter', function() {
                    startSearch(e.data.movie || e.data);
                });
                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });

        initSettings();
    }

    if (typeof Lampa !== 'undefined') {
        initMain();
    }

})();
