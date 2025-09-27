interface HeaderProps {
  language: string;
  onLanguageChange: (language: string) => void;
}

export default function Header({ language, onLanguageChange }: HeaderProps) {
  const languages = [
    { code: "en", name: "English", native: "English" },
    { code: "es", name: "Spanish", native: "Español" },
    { code: "fr", name: "French", native: "Français" },
    { code: "de", name: "German", native: "Deutsch" },
    { code: "it", name: "Italian", native: "Italiano" },
    { code: "pt", name: "Portuguese", native: "Português" },
    { code: "ru", name: "Russian", native: "Русский" },
    { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文" },
    { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文" },
    { code: "ja", name: "Japanese", native: "日本語" },
    { code: "ko", name: "Korean", native: "한국어" },
    { code: "ar", name: "Arabic", native: "العربية" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "ur", name: "Urdu", native: "اردو" },
    { code: "bn", name: "Bengali", native: "বাংলা" },
    { code: "tr", name: "Turkish", native: "Türkçe" },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "th", name: "Thai", native: "ไทย" },
    { code: "fil", name: "Tagalog / Filipino", native: "Filipino" },
    { code: "sw", name: "Swahili", native: "Kiswahili" }
  ];

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simpli-Docs</h1>
            <p className="text-muted-foreground mt-1">Transform complex legal and medical documents into clear, understandable language</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <label className="text-sm font-medium text-foreground mr-2">Explain in:</label>
              <select 
                className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                data-testid="select-language"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.native} - {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
