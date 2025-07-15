import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from '../utils/platform';
import { API_URL } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);

  const signIn = async (username, password) => {
    try {
      console.log(`🔐 Attempting to sign in at: ${API_URL}/api/auth/login`);
      console.log(`📱 Platform detected: ${Platform.OS}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📊 Response status: ${res.status}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Server error: ${res.status} - ${errorText}`);
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      console.log(`✅ Login successful`);
      setToken(data.token);
      setIsAuthenticated(true);
      await AsyncStorage.setItem('token', data.token);
      
    } catch (err) {
      console.error(`❌ Login failed:`, err.message);
      
      if (err.name === 'AbortError') {
        throw new Error('Request timeout - please check your network connection');
      } else if (err.message.includes('Network request failed')) {
        throw new Error('Network error - unable to connect to server. Please check if the server is running.');
      }
      throw err;
    }
  };

  const register = async (username, password) => {
    try {
      console.log(`Attempting to register at: ${API_URL}/api/auth/register`);
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        throw new Error('Registration failed');
      }
      return true;
    } catch (err) {
      console.error('Register error', err);
      throw err;
    }
  };

  const signOut = async () => {
    setIsAuthenticated(false);
    setToken(null);
    await AsyncStorage.removeItem('token');
  };

  useEffect(() => {
    // On mount, restore token
    (async () => {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        setIsAuthenticated(true);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, signIn, signOut, register, token }}>
      {children}
    </AuthContext.Provider>
  );
}; 