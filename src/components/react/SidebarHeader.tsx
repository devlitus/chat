// src/components/react/SidebarHeader.tsx

export function SidebarHeader() {
  return (
    <div className="sidebar-header">
      <div className="brand">
        <div className="brand-icon">
          <span className="material-symbols-outlined">smart_toy</span>
        </div>
        <h1>Chat AI</h1>
      </div>
      <button className="menu-btn" title="Toggle menu">
        <span className="material-symbols-outlined">menu_open</span>
      </button>
    </div>
  );
}
