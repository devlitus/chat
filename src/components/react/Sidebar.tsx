// src/components/react/Sidebar.tsx

import { SidebarHeader } from './SidebarHeader';
import { NewChatButton } from './NewChatButton';
import { SearchInput } from './SearchInput';
import { ChatHistoryList } from './ChatHistoryList';
import { UserProfile } from './UserProfile';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SidebarHeader />
      <NewChatButton />
      <SearchInput />
      <ChatHistoryList />
      <UserProfile />
    </aside>
  );
}
