// -------------------------------------------------------------------------- 
//  [ translator.js ]
//  › A translator package to use your Symfony translations with. 
// 
// @author Enzo Innocenzi <enzo.inno@gmail.com> @Suderiane
// @created 14/05/2019, 14:38:29
// @edited 14/05/2019, 14:38:30
// -------------------------------------------------------------------------- 

const MetaSettings = {
    // DOMAINS: 'domains'
}

const LoadTypes = {
    LOAD_FROM_META: 0,
    LOAD_FROM_CATALOGUE: 1
}

const DefaultSettings = {

    /**
     * The fallback locale for untranslated messages.
     */
    fallbackLocale: 'en',

    /**
     * The default domain for message translations.
     */
    defaultDomain: 'messages',

    /**
     * The way of loading the catalogue.
     * LOAD_FROM_META: loads the catalogue from the <meta> HTML tag
     * LOAD_FROM_CATALOGUE: loads the catalogue from the passed settings
     */
    loadType: LoadTypes.LOAD_FROM_META,

    /**
     * Removes the meta after being read.
     */
    removeMeta: true,

    /**
     * A callback executed when the message does not have a translation.
     */
    onUntranslatedMessageCallback: (id, domain, locale) => {},

    /**
     * A catalogue to be loaded by default.
     */
    catalogue: {},

    /**
     * The character separating multiple translations for pluralization.
     */
    pluralSeparator: '|',

    sPluralRegex: new RegExp(/^\w+\: +(.+)$/),
    cPluralRegex: new RegExp(/^\s*((\{\s*(\-?\d+[\s*,\s*\-?\d+]*)\s*\})|([\[\]])\s*(-Inf|\-?\d+)\s*,\s*(\+?Inf|\-?\d+)\s*([\[\]]))\s?(.+?)$/),
    iPluralRegex: new RegExp(/^\s*(\{\s*(\-?\d+[\s*,\s*\-?\d+]*)\s*\})|([\[\]])\s*(-Inf|\-?\d+)\s*,\s*(\+?Inf|\-?\d+)\s*([\[\]])/),
};

class Translator {

    constructor (settings = DefaultSettings) {
        this.settings = { ...DefaultSettings, ...settings };
        this.currentLocale = this.getDomLocale();
        
        this.loadCatalogue();
    }

    assertInitialized() {
        if (true !== this.initialized) {
            throw new Error('The catalogue is not initialized.');
        }
    }

    /**
     * Translates the given message.
     *
     * When a number is provided as a parameter named "%count%", the message is parsed for plural
     * forms and a translation is chosen according to this number using the following rules:
     *
     * Given a message with different plural translations separated by a
     * pipe (|), this method returns the correct portion of the message based
     * on the given number, locale and the pluralization rules in the message
     * itself.
     *
     * The message supports two different types of pluralization rules:
     *
     * interval: {0} There are no apples|{1} There is one apple|]1,Inf] There are %count% apples
     * indexed:  There is one apple|There are %count% apples
     *
     * The indexed solution can also contain labels (e.g. one: There is one apple).
     * This is purely for making the translations more clear - it does not
     * affect the functionality.
     *
     * The two methods can also be mixed:
     *     {0} There are no apples|one: There is one apple|more: There are %count% apples
     *
     * An interval can represent a finite set of numbers:
     *  {1,2,3,4}
     *
     * An interval can represent numbers between two numbers:
     *  [1, +Inf]
     *  ]-1,2[
     *
     * The left delimiter can be [ (inclusive) or ] (exclusive).
     * The right delimiter can be [ (exclusive) or ] (inclusive).
     * Beside numbers, you can use -Inf and +Inf for the infinite.
     *
     * @see https://en.wikipedia.org/wiki/ISO_31-11
     *
     * @param {string}      $id         The message id (may also be an object that can be cast to string)
     * @param {object}      $parameters An array of parameters for the message
     * @param {string|null} $domain     The domain for the message or null to use the default
     * @param {string|null} $locale     The locale or null to use the default
     *
     * @return {string} The translated string
     */
    trans(id, parameters, domain, locale) {
        this.assertInitialized();

        try {
            let _message,
                _locale = locale || this.currentLocale || this.settings.fallbackLocale;
            _message = this.getMessage(id, domain, _locale);
            _message = this.pluralize(_message, parameters, _locale);
            _message = this.replaceParameters(_message, parameters);

            return _message;
        } catch (error) {
            console.warn(error);
            return id;
        }
    }

    /**
     * Returns the message translated message if it exists, without parameters.
     * 
     * @param {string} id 
     * @param {string} domain 
     * @param {string} locale 
     * 
     * @return {string} Translated message.
     */
    getMessage(id, domain, locale) {
        this.assertInitialized();

        let _locales = [ locale || this.currentLocale, this.settings.fallbackLocale ],
            _domain = domain || this.settings.defaultDomain,
            _catalogue = this.catalogue;

        for (let i in _locales) {
            let _locale = _locales[i];
            
            if (this.hasMessage(id, _domain, _locale)) {
                return _catalogue[_locale][_domain][id];
            }
        }

        this.onUntranslatedMessage(id, _domain, locale);
        return id;
    }

    /**
     * Pluralizes the message if necessary.
     * This code is sjamelessly stolen from @see https://github.com/willdurand/BazingaJsTranslationBundle/blob/master/Resources/js/translator.js#L367 - thank you, Will.
     * 
     * @param {string} message 
     * @param {object} parameters 
     * 
     * @return {string} Pluralized message.
     */
    pluralize(message, parameters, locale) {
        let number = parameters['%count%'] || parameters['{{ count }}'] || 1;

        var _p,
            _e,
            _explicitRules = [],
            _standardRules = [],
            _parts         = message.split(this.settings.pluralSeparator || '|'),
            _matches       = [];

        for (_p = 0; _p < _parts.length; _p++) {
            var _part = _parts[_p];

            if (this.settings.cPluralRegex.test(_part)) {
                _matches = _part.match(this.settings.cPluralRegex);
                _explicitRules[_matches[0]] = _matches[_matches.length - 1];
            } else if (this.settings.sPluralRegex.test(_part)) {
                _matches = _part.match(this.settings.sPluralRegex);
                _standardRules.push(_matches[1]);
            } else {
                _standardRules.push(_part);
            }
        }

        for (_e in _explicitRules) {
            if (this.settings.iPluralRegex.test(_e)) {
                _matches = _e.match(this.settings.iPluralRegex);

                if (_matches[1]) {
                    var _ns = _matches[2].split(','),
                        _n;

                    for (_n in _ns) {
                        if (number == _ns[_n]) {
                            return _explicitRules[_e];
                        }
                    }
                } else {
                    var _leftNumber  = convert_number(_matches[4]);
                    var _rightNumber = convert_number(_matches[5]);

                    if (('[' === _matches[3] ? number >= _leftNumber : number > _leftNumber) &&
                        (']' === _matches[6] ? number <= _rightNumber : number < _rightNumber)) {
                        return _explicitRules[_e];
                    }
                }
            }
        }

        return _standardRules[this.getPluralPosition(number, locale)] || _standardRules[0] || undefined;

        return message;
    }

    /**
     * Gets the plural position for the given locale. 
     * This code is sjamelessly stolen from @see https://github.com/willdurand/BazingaJsTranslationBundle/blob/master/Resources/js/translator.js#L367 - thank you, Will.
     * 
     * @param {int} number 
     * @param {string} locale 
     */
    getPluralPosition(number, locale) {
        let _locale = String(locale || this.currentLocale || this.settings.fallbackLocale)
            .toLowerCase()
            .substr(0, 2);

        if ('pt_BR' === _locale) {
            _locale = 'xbr';
        }

        switch (_locale) {
            case 'bo':
            case 'dz':
            case 'id':
            case 'ja':
            case 'jv':
            case 'ka':
            case 'km':
            case 'kn':
            case 'ko':
            case 'ms':
            case 'th':
            case 'tr':
            case 'vi':
            case 'zh':
                return 0;

            case 'af':
            case 'az':
            case 'bn':
            case 'bg':
            case 'ca':
            case 'da':
            case 'de':
            case 'el':
            case 'en':
            case 'eo':
            case 'es':
            case 'et':
            case 'eu':
            case 'fa':
            case 'fi':
            case 'fo':
            case 'fur':
            case 'fy':
            case 'gl':
            case 'gu':
            case 'ha':
            case 'he':
            case 'hu':
            case 'is':
            case 'it':
            case 'ku':
            case 'lb':
            case 'ml':
            case 'mn':
            case 'mr':
            case 'nah':
            case 'nb':
            case 'ne':
            case 'nl':
            case 'nn':
            case 'no':
            case 'om':
            case 'or':
            case 'pa':
            case 'pap':
            case 'ps':
            case 'pt':
            case 'so':
            case 'sq':
            case 'sv':
            case 'sw':
            case 'ta':
            case 'te':
            case 'tk':
            case 'ur':
            case 'zu':
                return (number == 1) ? 0 : 1;

            case 'am':
            case 'bh':
            case 'fil':
            case 'fr':
            case 'gun':
            case 'hi':
            case 'ln':
            case 'mg':
            case 'nso':
            case 'xbr':
            case 'ti':
            case 'wa':
                return ((number === 0) || (number == 1)) ? 0 : 1;

            case 'be':
            case 'bs':
            case 'hr':
            case 'ru':
            case 'sr':
            case 'uk':
                return ((number % 10 == 1) && (number % 100 != 11)) ? 0 : (((number % 10 >= 2) && (number % 10 <= 4) && ((number % 100 < 10) || (number % 100 >= 20))) ? 1 : 2);

            case 'cs':
            case 'sk':
                return (number == 1) ? 0 : (((number >= 2) && (number <= 4)) ? 1 : 2);

            case 'ga':
                return (number == 1) ? 0 : ((number == 2) ? 1 : 2);

            case 'lt':
                return ((number % 10 == 1) && (number % 100 != 11)) ? 0 : (((number % 10 >= 2) && ((number % 100 < 10) || (number % 100 >= 20))) ? 1 : 2);

            case 'sl':
                return (number % 100 == 1) ? 0 : ((number % 100 == 2) ? 1 : (((number % 100 == 3) || (number % 100 == 4)) ? 2 : 3));

            case 'mk':
                return (number % 10 == 1) ? 0 : 1;

            case 'mt':
                return (number == 1) ? 0 : (((number === 0) || ((number % 100 > 1) && (number % 100 < 11))) ? 1 : (((number % 100 > 10) && (number % 100 < 20)) ? 2 : 3));

            case 'lv':
                return (number === 0) ? 0 : (((number % 10 == 1) && (number % 100 != 11)) ? 1 : 2);

            case 'pl':
                return (number == 1) ? 0 : (((number % 10 >= 2) && (number % 10 <= 4) && ((number % 100 < 12) || (number % 100 > 14))) ? 1 : 2);

            case 'cy':
                return (number == 1) ? 0 : ((number == 2) ? 1 : (((number == 8) || (number == 11)) ? 2 : 3));

            case 'ro':
                return (number == 1) ? 0 : (((number === 0) || ((number % 100 > 0) && (number % 100 < 20))) ? 1 : 2);

            case 'ar':
                return (number === 0) ? 0 : ((number == 1) ? 1 : ((number == 2) ? 2 : (((number >= 3) && (number <= 10)) ? 3 : (((number >= 11) && (number <= 99)) ? 4 : 5))));

            default:
                return 0;
        }
    }

    /**
     * Replaces parameters in the given message.
     * 
     * @param {string} message 
     * @param {object} parameters 
     * 
     * @return {string} Message with replaced parameters.
     */
    replaceParameters(message, parameters) {
        for (let key in parameters) {
            message = String(message).replace(key, parameters[key]);
        }

        return message;
    }

    /**
     * Returns true if the given id is contained in the current catalogue for the given domain and locale.
     * 
     * @param {string} id 
     * @param {string} domain 
     * @param {string} locale 
     * 
     * @return {boolean} `true` if message exists, `false` if not.
     */
    hasMessage(id, domain, locale) {
        this.assertInitialized();

        let _catalogue = this.catalogue;

        if (!(locale in _catalogue)) {
            console.log(`${locale} not in catalogue`)
            return false;
        }

        if (!(domain in _catalogue[locale])) {
            console.log(`domain ${domain} not in ${locale}`)
            return false;
        }

        if (!(id in _catalogue[locale][domain])) {
            console.log(`id ${id} not in ${domain}`)
            return false;
        }

        return true;
    }

    /**
     * Executed when a message does not have a translation.
     * 
     * @param {string} id 
     * @param {string} domain 
     * @param {string} locale 
     */
    onUntranslatedMessage(id, domain, locale) {
        if (typeof this.settings.onUntranslatedMessageCallback === 'function') {
            this.settings.onUntranslatedMessageCallback(id, domain, locale);
        }
    }

    /**
     * Loads the message catalogue.
     * If the catalogue parameter is empty, it will check for the meta[translation] URL in order to retrieve the translations via the JsTranslationBundle API.
     * 
     * @param {object} catalogue
     * 
     * @return {void}
     */
    loadCatalogue() {
        switch (this.settings.loadType) {

            case LoadTypes.LOAD_FROM_CATALOGUE:
                this.loadFromCatalogue();
                break;

            case LoadTypes.LOAD_FROM_META:
                this.loadFromMeta();
                this.loadMetaSettings();
                break;

            default:
                throw new Error('Invalid load type.');
        }

        return this;
    }

    /**
     * Loads the translations from the passed catalogue in settings.
     * 
     * @return self
     */
    loadFromCatalogue() {
        if (isEmpty(this.settings.catalogue)) {
            throw new Error('The given catalogue is empty.');
        }
        
        this.catalogue = this.settings.catalogue;
        this.initialized = true;

        return this;
    }

    /**
     * Loads the translations from the meta tag.
     * 
     * @return self
     */
    loadFromMeta() {
        let meta = document.head.querySelector("[name=translation][content]") || undefined;

        if (undefined === meta) {
            throw new Error('The translation meta could not be found.');
        }

        this.catalogue = JSON.parse(meta.content);
        meta.remove();
    }

    /**
     * Loads the settings from the meta tag.
     * 
     * @return self
     */
    loadMetaSettings() {
        let meta = document.head.querySelector("[name=translation-settings][content]") || undefined,
            settings;

        if (undefined === meta) {
            return;
        }

        settings = JSON.parse(meta.content);
        meta.remove();

        for (let i in settings) {
            let _setting = settings[i];

            switch (_setting) {
                // TODO.
            }
        }
    }

    /**
     * Returns the domains available for the given locale.
     * 
     * @param {string} locale 
     */
    getDomains(locale) {
        this.assertInitialized();

        let catalogue = this.catalogue,
            _domains = [];

        if (undefined === catalogue[locale]) {
            _domains;
        }

        for (let domain in catalogue[locale]) {
            _domains.push(domain);
        }

        return _domains;
    }

    /**
     * Returns the catalogue for the given domains and locale.
     * 
     * @param {*} domains 
     * @param {*} locale 
     */
    getCatalogue(domains, locales) {
        this.assertInitialized();

        let catalogue = this.catalogue,
            _catalogue = {};

        if (undefined === locales || true !== isIterable(locales)) {
            locales = [ this.settings.fallbackLocale ];
        }

        if (undefined === domains || true !== isIterable(domains)) {
            domains = [ this.settings.defaultDomain ];
        }

        for (let locale of locales) {
            if (locale in catalogue) {
                for (let domain of domains) {
                    if (domain in catalogue[locale]) {
                        _catalogue[locale][domain] = catalogue[locale][domain];
                    } else {
                        console.warn(`'${domain}' does not exist in the catalogue for the '${locale}' locale.`);
                    }
                }
            } else {
                console.warn(`Skipped locales '${locale}' as it is not in the current catalogue.`);
            }
        }

        return _catalogue;
    }
    
    /**
     * Adds a key/value in the catalogue. If the catalogue is not initialized, it will be initialized with that value.
     * If the key exists, it will be replaced.
     * 
     * @param {string} key 
     * @param {string} value 
     * @param {string} domain 
     * @param {string} locale 
     * 
     * @return {Translator} Returns self for chaining.
     */
    add(key, value, domain, locale) {
        let _locale = locale || this.currentLocale || this.settings.fallbackLocale,
            _domain = domain || this.settings.defaultDomain;

        if (undefined === this.catalogue) {
            this.catalogue = {};
        }

        if (undefined === this.catalogue[_locale]) {
            this.catalogue[_locale] = {};
        }

        if (undefined === this.catalogue[_domain]) {
            this.catalogue[_locale][_domain] = {};
        }

        this.catalogue[_locale][_domain][key] = value;
        this.initialized = true;

        return this;
    }

    /**
     * Returns the current DOM locale. If unset, returns `null`.
     * 
     * @return {string}|null 
     */
    getDomLocale() {
        if (undefined !== document) {
            return document.documentElement.lang || null;
        }

        return null;
    }
}

/**
 * Helper function determining if the given object is iterable.
 * 
 * @param {object} obj 
 */
function isIterable(obj) {
    if (obj == null) {
        return false;
    }

    return typeof obj[Symbol.iterator] === 'function';
}

/**
 * Helper function determining if the given object is empty.
 * 
 * @param {object} obj 
 */
function isEmpty(obj) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

export default new Translator(DefaultSettings);
export { Translator, MetaSettings, LoadTypes, DefaultSettings };