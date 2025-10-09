// frontend/src/components/layout/Sidebar.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Users, ShoppingBasket, Settings, User } from 'lucide-react';
import './Sidebar.css'; // For specific styling not easily done with Tailwind

interface SidebarItem {
  name: string;
  path: string;
  IconComponent: React.ElementType; // Use React.ElementType for Lucide icons
}

const sidebarMenuItems: SidebarItem[] = [
  { name: 'Dashboard Overview', path: '/', IconComponent: LayoutDashboard },
  { name: 'Parking Violation', path: '/parking-violations', IconComponent: Car },
  { name: 'Table Occupancy', path: '/table-occupancy', IconComponent: Users },
  { name: 'Chilled Basket Alert', path: '/chilled-basket-alerts', IconComponent: ShoppingBasket },
];

const otherMenuItems: SidebarItem[] = [
  { name: 'AI Setting', path: '/ai-settings', IconComponent: Settings },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

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
          <li className="sidebar-menu-category">OTHERS</li>
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
      <div className="sidebar-footer">
        <div className="sidebar-user-profile">
          <User className="sidebar-user-icon" /> {/* Using Lucide User icon */}
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