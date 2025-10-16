// frontend/src/components/layout/Sidebar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Settings, User, UserSearch, LogOut, UserCog } from 'lucide-react';
import './Sidebar.css'; // For specific styling not easily done with Tailwind

interface SidebarItem {
  name: string;
  path: string;
  IconComponent: React.ElementType; // Use React.ElementType for Lucide icons
}

const sidebarMenuItems: SidebarItem[] = [
  { name: 'Dashboard Overview', path: '/', IconComponent: LayoutDashboard },
  { name: 'AI Parking Violation', path: '/parking-violations', IconComponent: Car },
  { name: 'AI People Detection', path: '/people-detection', IconComponent: UserSearch },
  // { name: 'Table Occupancy', path: '/table-occupancy', IconComponent: Users },
  // { name: 'Chilled Basket Alert', path: '/chilled-basket-alerts', IconComponent: ShoppingBasket },
];

const otherMenuItems: SidebarItem[] = [
  // { name: 'AI Setting', path: '/ai-settings', IconComponent: Settings },
  { name: 'AI Parking Setting', path: '/parking-setting', IconComponent: Settings },
  { name: 'AI People Setting', path: '/people-setting', IconComponent: Settings },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  // 3. เพิ่ม State สำหรับจัดการการเปิด-ปิดเมนู
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  
  // 4. สร้าง Ref สำหรับอ้างอิงถึง element ของเมนู
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // 5. ฟังก์ชันสำหรับจัดการการ Logout
  const handleLogout = () => {
    console.log("Logging out...");
    // เพิ่มโค้ด Logout จริงที่นี่ เช่น ลบ token, redirect ไปหน้า login
    setProfileMenuOpen(false); // ปิดเมนูหลังคลิก
  };

  // 6. ใช้ useEffect เพื่อตรวจจับการคลิกนอกเมนู
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    // เพิ่ม event listener เมื่อ component ถูก mount
    document.addEventListener('mousedown', handleClickOutside);
    // ลบ event listener ออกเมื่อ component ถูก unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <aside className="sidebar-container">
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          <li className="sidebar-menu-category">MENU</li>
          {sidebarMenuItems.map((item) => (
            <li key={item.name} className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}>
              <Link to={item.path} className="sidebar-link">
                <item.IconComponent className="sidebar-icon" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="sidebar-menu">
          <li className="sidebar-menu-category">SETTING</li>
          {otherMenuItems.map((item) => (
            <li key={item.name} className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}>
              <Link to={item.path} className="sidebar-link">
                <item.IconComponent className="sidebar-icon" />
                {item.name}
              </Link>
            </li>
          ))} 
        </ul>
      </nav>

      {/* Sidebar Footer - User Profile */}
      <div className="sidebar-footer" ref={profileMenuRef}>
        {/* เมนูที่จะแสดงขึ้นมา */}
        {isProfileMenuOpen && (
          <div className="profile-menu">
            <Link to="/manage-profile" className="profile-menu-item" onClick={() => setProfileMenuOpen(false)}>
              <UserCog size={16} className="profile-menu-icon" />
              จัดการโปรไฟล์
            </Link>
            <button onClick={handleLogout} className="profile-menu-item">
              <LogOut size={16} className="profile-menu-icon" />
              ออกจากระบบ
            </button>
          </div>
        )}

        {/* User Profile ที่คลิกได้ */}
        <div 
          className="sidebar-user-profile" 
          onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
        >
          <User className="sidebar-user-icon" />
          <div className="sidebar-user-details">
            <span className="sidebar-user-name">Admin</span>
            <span className="sidebar-user-role">Command Center</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;