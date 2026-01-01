import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// デフォルト言語（システム言語を取得）
const getSystemLanguage = (): string => {
    if (typeof window === 'undefined') return 'ja';

    const navigatorLanguage = navigator.language || 'ja';
    // 'ja-JP' -> 'ja', 'en-US' -> 'en'
    const lang = navigatorLanguage.split('-')[0];

    // サポートしている言語のみ返す
    return lang === 'en' ? 'en' : 'ja';
};

i18n
    .use(initReactI18next)
    .init({
        resources: {
            ja: {
                translation: require('../../public/locales/ja/translation.json')
            },
            en: {
                translation: require('../../public/locales/en/translation.json')
            }
        },
        lng: getSystemLanguage(),
        fallbackLng: 'ja',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
