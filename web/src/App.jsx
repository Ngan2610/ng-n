import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Features from './pages/Features.jsx';
import Demo from './pages/Demo.jsx';
import Pricing from './pages/Pricing.jsx';
import About from './pages/About.jsx';
import Faq from './pages/Faq.jsx';
import Contact from './pages/Contact.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { Terms, Privacy } from './pages/Legal.jsx';
import Admin from './pages/Admin.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminQr from './pages/AdminQr.jsx';
import Guest from './pages/Guest.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminVideos from './pages/AdminVideo.jsx';
import AdminLanguages from './pages/AdminLanguages.jsx';
import AdminNarrations from './pages/AdminNarrations.jsx';
import AdminSubtitles from './pages/AdminSubtitles.jsx';
import AdminFeedback from './pages/AdminFeedback.jsx';
import Account from './pages/Account.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="features" element={<Features />} />
        <Route path="demo" element={<Demo />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="about" element={<About />} />
        <Route path="faq" element={<Faq />} />
        <Route path="contact" element={<Contact />} />
        <Route path="account" element={<Account />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="guest" element={<Guest />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Admin />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="videos" element={<AdminVideos />} />
        <Route path="narrations" element={<AdminNarrations />} />
        <Route path="subtitles" element={<AdminSubtitles />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="languages" element={<AdminLanguages />} />
        <Route path="qr" element={<AdminQr />} />
      </Route>
    </Routes>
  );
}
