import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { API_URL } from '../config/api';

const NetworkTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const runNetworkTest = async () => {
    setTesting(true);
    setTestResults([]);
    
    const results = [];
    
    // Test 1: Basic connectivity
    try {
      const response = await fetch(`${API_URL}/`, {
        method: 'GET',
        timeout: 5000,
      });
      
      results.push({
        test: 'Server Health',
        status: response.ok ? 'PASS' : 'FAIL',
        details: `Status: ${response.status}`,
      });
    } catch (error) {
      results.push({
        test: 'Server Health',
        status: 'FAIL',
        details: error.message,
      });
    }

    // Test 2: Authentication endpoint
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' }),
        timeout: 5000,
      });
      
      results.push({
        test: 'Auth Endpoint',
        status: response.status === 401 ? 'PASS' : 'FAIL',
        details: `Status: ${response.status} (401 expected)`,
      });
    } catch (error) {
      results.push({
        test: 'Auth Endpoint',
        status: 'FAIL',
        details: error.message,
      });
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Test</Text>
      <Text style={styles.url}>Testing: {API_URL}</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={runNetworkTest}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Testing...' : 'Run Test'}
        </Text>
      </TouchableOpacity>

      {testResults.map((result, index) => (
        <View key={index} style={styles.result}>
          <Text style={[styles.resultText, result.status === 'PASS' ? styles.pass : styles.fail]}>
            {result.test}: {result.status}
          </Text>
          <Text style={styles.details}>{result.details}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  url: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  result: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 5,
  },
  resultText: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pass: {
    color: '#4CAF50',
  },
  fail: {
    color: '#F44336',
  },
  details: {
    fontSize: 12,
    color: '#666',
  },
});

export default NetworkTest; 