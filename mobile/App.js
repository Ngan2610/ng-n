import React from 'react';
import { Text } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from './src/context/I18nContext';
import { AuthProvider } from './src/context/AuthContext';
import { useTheme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import DemoScreen from './src/screens/DemoScreen';
import PricingScreen from './src/screens/PricingScreen';
import InfoScreen from './src/screens/InfoScreen';
import AccountScreen from './src/screens/AccountScreen';

const Tab = createBottomTabNavigator();
const icon = (emoji) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;

function Tabs() {
  const { t } = useI18n();
  const c = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: c.dark,
    colors: { ...DefaultTheme.colors, primary: c.accent, background: c.bg, card: c.panel, text: c.ink, border: c.line },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.ink,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: { backgroundColor: c.panel, borderTopColor: c.line },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tab_home'), tabBarIcon: icon('🍳') }} />
        <Tab.Screen name="Demo" component={DemoScreen} options={{ tabBarLabel: t('nav_demo'), tabBarIcon: icon('🎧') }} />
        <Tab.Screen name="Pricing" component={PricingScreen} options={{ tabBarLabel: t('nav_pricing'), tabBarIcon: icon('💳') }} />
        <Tab.Screen name="Info" component={InfoScreen} options={{ tabBarLabel: t('tab_info'), tabBarIcon: icon('ℹ️') }} />
        <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: t('tab_account'), tabBarIcon: icon('👤') }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <Tabs />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
