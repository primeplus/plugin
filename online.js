(function () {
    'use strict';

    function OnlinePlugin() {
        var network = new Lampa.Reguest();

        var DEFAULTS = {
            kodik: {
                url: 'https://kodikapi.com',
                token: '41dd95f84c21719b09d6c71182237a25',
                enabled: true,
                name: 'Kodik'
            },
            videocdn: {
                url: 'https://videocdn.tv',
                token: '822Lv92DG3umkMddXZpuVT1lRehwIh16',
                enabled: true,
                name: 'VideoCDN'
            },
            hdvb: {
                url: 'https://hdvb.cc',
                token: '26857f5979203e91122a76203a743477',
                enabled: true,
                name: 'HDVB'
            },
            filmix: {
                url: 'http://filmixapp.cyou',
                token: '',
                enabled: true,
                name: 'Filmix'
            },
            rezka: {
                url: 'https://rezka.ag',
                token: '', // Not used but kept for consistency
                enabled: true,
                name: 'Rezka'
            },
            alloha: {
                url: 'https://api.apbugall.org',
                token: '',
                enabled: true,
                name: 'Alloha'
            },
            collaps: {
                url: 'https://api.collaps.org',
                token: '', // Not typically needed for public API but good to have
                enabled: true,
                name: 'Collaps'
            }
        };

        var sources = {};

        // --- Helpers ---
        function normalizeURL(url) {
            return (url || '').replace(/\/+$/, '');
        }

        function cleanTitle(str) {
            return (str || '').replace(/[\-\u2010-\u2015\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, ' ').replace(/ +/g, ' ').trim();
        }

        function buildUrl(url, params) {
            var str = [];
            for (var p in params) {
                if (params.hasOwnProperty(p) && params[p]) {
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
                }
            }
            if (str.length === 0) return url;
            return url + (url.indexOf('?') > -1 ? '&' : '?') + str.join("&");
        }

        // --- Configuration Manager ---
        function initSettings() {
            for (var key in DEFAULTS) {
                sources[key] = {
                    url: Lampa.Storage.get('online_mod_' + key + '_url', DEFAULTS[key].url),
                    token: Lampa.Storage.get('online_mod_' + key + '_token', DEFAULTS[key].token),
                    enabled: Lampa.Storage.get('online_mod_' + key + '_enabled', DEFAULTS[key].enabled),
                    name: DEFAULTS[key].name
                };
            }
        }

        // --- Settings UI ---
        function openSettings() {
            var controller = Lampa.Controller.enabled().name;
            var title = Lampa.Lang.translate('title_settings') + ' - Online';
            var items = [];

            for (var key in sources) {
                (function(k) {
                    var s = sources[k];
                    items.push({
                        title: s.name,
                        subtitle: (s.enabled ? Lampa.Lang.translate('settings_param_status_on') || 'On' : Lampa.Lang.translate('settings_param_status_off') || 'Off') + ' - ' + s.url,
                        url: s.url,
                        enabled: s.enabled,
                        onSelect: function() {
                            openSourceSettings(k);
                        }
                    });
                })(key);
            }

            Lampa.Select.show({
                title: title,
                items: items,
                onBack: function() {
                    Lampa.Controller.toggle(controller);
                }
            });
        }

        function openSourceSettings(key) {
            var source = sources[key];
            var menu = [
                {
                    title: Lampa.Lang.translate('settings_param_status') || 'Status',
                    subtitle: source.enabled ? (Lampa.Lang.translate('settings_param_status_on') || 'On') : (Lampa.Lang.translate('settings_param_status_off') || 'Off'),
                    onSelect: function() {
                        source.enabled = !source.enabled;
                        Lampa.Storage.set('online_mod_' + key + '_enabled', source.enabled);
                        this.subtitle = source.enabled ? (Lampa.Lang.translate('settings_param_status_on') || 'On') : (Lampa.Lang.translate('settings_param_status_off') || 'Off');
                        Lampa.Activity.render();
                    }
                },
                {
                    title: 'URL',
                    subtitle: source.url,
                    onSelect: function() {
                        Lampa.Input.edit({
                            value: source.url,
                            title: 'URL for ' + source.name,
                            free: true,
                            nosave: true
                        }, function(newVal) {
                            source.url = newVal;
                            Lampa.Storage.set('online_mod_' + key + '_url', source.url);
                            Lampa.Activity.back();
                        });
                    }
                },
                {
                    title: 'Token',
                    subtitle: source.token ? source.token.substr(0, 10) + '...' : 'Empty',
                    onSelect: function() {
                        Lampa.Input.edit({
                            value: source.token,
                            title: 'Token for ' + source.name,
                            free: true,
                            nosave: true
                        }, function(newVal) {
                            source.token = newVal;
                            Lampa.Storage.set('online_mod_' + key + '_token', source.token);
                            Lampa.Activity.back();
                        });
                    }
                },
                {
                    title: 'Reset to Default',
                    subtitle: 'Restore default URL and Token',
                    onSelect: function() {
                        source.url = DEFAULTS[key].url;
                        source.token = DEFAULTS[key].token;
                        Lampa.Storage.set('online_mod_' + key + '_url', source.url);
                        Lampa.Storage.set('online_mod_' + key + '_token', source.token);
                        Lampa.Noty.show('Restored defaults for ' + source.name);
                        Lampa.Activity.back();
                    }
                }
            ];

            Lampa.Select.show({
                title: source.name,
                items: menu,
                onBack: function() {
                    openSettings();
                }
            });
        }

        // Add settings button to main settings
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'main') {
                e.body.find('[data-name="plugins"]').after('<div class="settings__layerselector-item" data-name="online_mod"><div class="settings__layerselector-icon"><svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><div class="settings__layerselector-title">Online Mod</div></div>');
                e.body.find('[data-name="online_mod"]').on('click', function () {
                    openSettings();
                });
            }
        });

        // --- Balancers ---
        var Balancers = {
            kodik: function(card) {
                return new Promise(function(resolve, reject) {
                    var url = normalizeURL(sources.kodik.url) + '/search';
                    var params = {
                        token: sources.kodik.token,
                        title: cleanTitle(card.title),
                        limit: 10,
                        with_material_data: true
                    };
                    url = buildUrl(url, params);

                    network.silent(url, function(json) {
                        if (json && json.results && json.results.length) {
                            var results = json.results.map(function(item) {
                                return {
                                    name: 'Kodik',
                                    title: item.title,
                                    url: item.link,
                                    quality: item.quality || 'Unknown',
                                    translation: item.translation ? item.translation.title : 'Original',
                                    is_iframe: true
                                };
                            });
                            resolve(results);
                        } else {
                            resolve([]);
                        }
                    }, function(a, c) {
                        reject('Kodik error');
                    });
                });
            },
            videocdn: function(card) {
                return new Promise(function(resolve, reject) {
                    var url = normalizeURL(sources.videocdn.url) + '/api/short';
                    var params = {
                        api_token: sources.videocdn.token,
                        title: cleanTitle(card.title)
                    };
                    if (card.kp_id) params.kinopoisk_id = card.kp_id;
                    else if (card.imdb_id) params.imdb_id = card.imdb_id;
                    url = buildUrl(url, params);

                    network.silent(url, function(json) {
                        if (json && json.data && json.data.length) {
                             var results = json.data.map(function(item) {
                                return {
                                    name: 'VideoCDN',
                                    title: item.title,
                                    url: item.iframe_src,
                                    quality: item.quality || 'HD',
                                    translation: 'Default',
                                    is_iframe: true
                                };
                            });
                            resolve(results);
                        } else {
                            resolve([]);
                        }
                    }, function() {
                        reject('VideoCDN error');
                    });
                });
            },
            hdvb: function(card) {
                return new Promise(function(resolve, reject) {
                    var url = normalizeURL(sources.hdvb.url) + '/api/videos.json';
                    var params = {
                        token: sources.hdvb.token,
                        title: cleanTitle(card.title)
                    };
                    if (card.kp_id) params.id_kp = card.kp_id;
                    url = buildUrl(url, params);

                    network.silent(url, function(json) {
                        if (json && json.length) {
                             var results = json.map(function(item) {
                                return {
                                    name: 'HDVB',
                                    title: item.title_ru || item.title_en,
                                    url: item.iframe_url,
                                    quality: item.quality || 'HD',
                                    translation: item.translator || 'Default',
                                    is_iframe: true
                                };
                            });
                            resolve(results);
                        } else {
                            resolve([]);
                        }
                    }, function() {
                        reject('HDVB error');
                    });
                });
            },
            filmix: function(card) {
                return new Promise(function(resolve, reject) {
                    if(!sources.filmix.token) {
                        resolve([]);
                        return;
                    }
                    var url = normalizeURL(sources.filmix.url) + '/api/v2/search';
                    var params = {
                        user_token: sources.filmix.token,
                        name: cleanTitle(card.title)
                    };
                    url = buildUrl(url, params);
                    network.silent(url, function(json) {
                        if (json && json.length) {
                            var results = json.map(function(item) {
                                return {
                                    name: 'Filmix',
                                    title: item.title,
                                    url: item.link,
                                    quality: item.quality || 'HD',
                                    translation: 'Default',
                                    is_iframe: true
                                };
                            });
                            resolve(results);
                        } else {
                            resolve([]);
                        }
                    }, function() {
                        reject('Filmix error');
                    });
                });
            },
            rezka: function(card) {
                return new Promise(function(resolve, reject) {
                    // Direct link to search
                    if(!sources.rezka.enabled) {
                        resolve([]);
                        return;
                    }
                    var searchUrl = normalizeURL(sources.rezka.url) + '/search/?q=' + encodeURIComponent(cleanTitle(card.title));
                    resolve([{
                        name: 'Rezka',
                        title: card.title + ' (Search)',
                        url: searchUrl,
                        quality: 'Site',
                        translation: 'Search',
                        is_iframe: false,
                        is_link: true
                    }]);
                });
            },
            alloha: function(card) {
                return new Promise(function(resolve, reject) {
                     if(!sources.alloha.token) {
                        resolve([]);
                        return;
                    }
                    var url = normalizeURL(sources.alloha.url) + '/';
                    var params = {
                        token: sources.alloha.token,
                        name: cleanTitle(card.title)
                    };
                    url = buildUrl(url, params);
                    network.silent(url, function(json) {
                        if (json && json.data && json.data.length) {
                            var results = json.data.map(function(item) {
                                return {
                                    name: 'Alloha',
                                    title: item.name,
                                    url: item.iframe,
                                    quality: item.quality || 'HD',
                                    translation: item.translation || 'Default',
                                    is_iframe: true
                                };
                            });
                            resolve(results);
                        } else {
                            resolve([]);
                        }
                    }, function() {
                        reject('Alloha error');
                    });
                });
            },
            collaps: function(card) {
                return new Promise(function(resolve, reject) {
                    if (!sources.collaps.enabled) {
                        resolve([]);
                        return;
                    }
                    // Collaps is strict. Just return empty for now as requested unless we have specific logic
                    resolve([]);
                });
            }
        };

        // --- Search Controller ---
        function findVideo(card) {
            Lampa.Loading.start(function() {
                Lampa.Loading.stop();
            });

            var promises = [];

            for (var key in sources) {
                if (sources[key].enabled && Balancers[key]) {
                    // Create promise for each source and catch errors to prevent failure of all
                    promises.push(
                        Balancers[key](card)
                        .then(function(result) {
                            return { status: 'fulfilled', value: result };
                        })
                        .catch(function(err) {
                            return { status: 'rejected', reason: err };
                        })
                    );
                }
            }

            Promise.all(promises).then(function(results) {
                Lampa.Loading.stop();

                var allItems = [];
                results.forEach(function(result) {
                    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                        allItems = allItems.concat(result.value);
                    }
                });

                if (allItems.length) {
                    showResults(allItems);
                } else {
                    Lampa.Noty.show(Lampa.Lang.translate('online_query_null') || 'No sources found');
                }
            });
        }

        function showResults(items) {
            Lampa.Select.show({
                title: 'Online',
                items: items.map(function(item) {
                    return {
                        title: item.title,
                        subtitle: item.name + ' - ' + item.quality + (item.translation ? ' - ' + item.translation : ''),
                        url: item.url,
                        is_iframe: item.is_iframe,
                        is_link: item.is_link,
                        onSelect: function(a) {
                            if(item.is_link) {
                                Lampa.Platform.api().open ? Lampa.Platform.api().open(item.url) : window.open(item.url, '_blank');
                            } else if (item.is_iframe) {
                                var action = [
                                    {
                                        title: Lampa.Lang.translate('title_open') || 'Open',
                                        subtitle: 'Open in browser/external player',
                                        onSelect: function() {
                                            Lampa.Platform.api().open ? Lampa.Platform.api().open(item.url) : window.open(item.url, '_blank');
                                        }
                                    },
                                    {
                                        title: 'Play (Internal)',
                                        subtitle: 'Attempt to play in internal player (experimental)',
                                        onSelect: function() {
                                            Lampa.Player.play({url: item.url, title: item.title});
                                        }
                                    }
                                ];
                                Lampa.Select.show({title: item.name, items: action, onBack: function(){ showResults(items); }});
                            } else {
                                Lampa.Player.play(item);
                            }
                        }
                    };
                }),
                onBack: function() {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        // --- UI Integration ---
        function addWatchButton(object, where) {
            if ($(where).find('.view--online').length) return;

            var btn = $('<div class="full-start__button selector view--online" data-subtitle="Watch Online"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" height="24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg><span>Online</span></div>');

            btn.on('hover:enter', function() {
                findVideo(object);
            });

            $(where).find('.full-start__buttons').append(btn);
        }

        // Listener for Full page load
        Lampa.Listener.follow('full', function(e) {
            if(e.type == 'complite') {
                addWatchButton(e.object, e.body);
            }
        });

        initSettings();
    }

    if(window.Lampa) new OnlinePlugin();
})();
