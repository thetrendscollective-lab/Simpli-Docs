interface TabNavigationProps {
  activeTab: "summary" | "glossary" | "original";
  onTabChange: (tab: "summary" | "glossary" | "original") => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: "summary", label: "Summary", icon: "fas fa-file-text" },
    { id: "glossary", label: "Glossary", icon: "fas fa-book" },
    { id: "original", label: "Original Text", icon: "fas fa-eye" },
  ] as const;

  return (
    <div className="border-b border-border">
      <nav className="flex space-x-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onTabChange(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            <i className={`${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
