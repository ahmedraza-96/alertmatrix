import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { Platform } from '../utils/platform';
import { WebView } from 'react-native-webview';

const LiveVideoStream = ({ 
  streamUrl, 
  style, 
  onError, 
  onLoad,
}) => {
  const [error, setError] = useState(null);

  // Fix localhost URLs for mobile platforms
  const fixStreamUrl = (url) => {
    if (!url) return url;
    
    // For web platform, keep localhost as-is
    if (Platform.OS === 'web') {
      return url;
    }
    
    // Replace localhost with 10.0.2.2 for Android emulator
    if (Platform.OS === 'android' && url.includes('localhost')) {
      return url.replace('localhost', '10.0.2.2');
    }
    
    return url;
  };

  // Reset when URL changes
  useEffect(() => {
    if (streamUrl) {
      console.log('🎬 LiveVideoStream URL:', streamUrl);
      setError(null);
    }
  }, [streamUrl]);

  if (!streamUrl) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>No stream URL provided</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Stream Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const fixedStreamUrl = fixStreamUrl(streamUrl);

  // For web platform - use Image component with MJPEG support
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <Image
          source={{ uri: fixedStreamUrl }}
          style={styles.image}
          resizeMode="cover"
          onLoad={() => {
            console.log('✅ Image loaded successfully');
            setError(null);
            if (onLoad) onLoad();
          }}
          onError={(err) => {
            console.log('❌ Image load error:', err);
            setError('Failed to load video stream');
            if (onError) onError('Video stream load failed');
          }}
        />
        
        {/* Live indicator */}
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>🔴 LIVE</Text>
        </View>
      </View>
    );
  }

  // For mobile platforms - use WebView for MJPEG streams
  const webViewHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
        }
        .container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .live-indicator {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.7);
          color: #00ff00;
          padding: 5px 10px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: bold;
          z-index: 10;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${fixedStreamUrl}" alt="Live Video Stream" 
             onload="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('loaded')"
             onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error')" />
        <div class="live-indicator">🔴 LIVE</div>
      </div>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html: webViewHtml }}
        style={styles.webView}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          console.log('📱 WebView message:', message);
          if (message === 'loaded') {
            setError(null);
            if (onLoad) onLoad();
          } else if (message === 'error') {
            setError('Failed to load video stream');
            if (onError) onError('Video stream load failed');
          }
        }}
        onError={() => {
          console.log('❌ WebView error');
          setError('WebView failed to load');
          if (onError) onError('WebView failed to load');
        }}
        javaScriptEnabled={true}
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  liveIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1000,
  },
  liveText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#f44336',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});

export default LiveVideoStream; 