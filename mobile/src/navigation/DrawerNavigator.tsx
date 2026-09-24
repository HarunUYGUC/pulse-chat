import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { ChannelDrawerContent } from '../components/ChannelDrawerContent';
import { colors } from '../theme/colors';

const Drawer = createDrawerNavigator();

export const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <ChannelDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: {
          backgroundColor: colors.drawerBackground,
          width: 290,
        },
        overlayColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <Drawer.Screen name="Chat" component={ChatScreen} />
    </Drawer.Navigator>
  );
};
