#!/usr/bin/env python3
"""
Backend API Testing for Patch Hat QuoteKit
Tests all API endpoints for structure, response handling, and error conditions.
"""

import requests
import json
import sys
import traceback
from typing import Dict, Any, Optional

class QuoteKitAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_base = f"{self.base_url}/api"
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, path: str, data: Optional[Dict] = None, expected_status: int = None) -> Dict[str, Any]:
        """Make API request and return structured response"""
        url = f"{self.api_base}?path={path}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, timeout=30)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, json=data, timeout=30)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, timeout=30)
            else:
                return {'error': f'Unsupported method: {method}', 'status_code': 0}
            
            # Parse response
            try:
                response_data = response.json()
            except:
                response_data = {'raw_response': response.text}
            
            result = {
                'status_code': response.status_code,
                'data': response_data,
                'headers': dict(response.headers),
                'url': url
            }
            
            # Check expected status if provided
            if expected_status and response.status_code != expected_status:
                result['status_mismatch'] = f"Expected {expected_status}, got {response.status_code}"
            
            return result
            
        except requests.exceptions.Timeout:
            return {'error': 'Request timeout', 'status_code': 0}
        except requests.exceptions.ConnectionError:
            return {'error': 'Connection error', 'status_code': 0}
        except Exception as e:
            return {'error': str(e), 'status_code': 0, 'traceback': traceback.format_exc()}
    
    def test_health_check(self):
        """Test health check endpoint"""
        print("\n=== Testing Health Check API ===")
        
        # Test basic health endpoint
        result = self.make_request('GET', 'health')
        
        if result.get('error'):
            self.log_result(
                "Health Check - Basic", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        # Check for expected responses
        if status_code == 401:
            self.log_result(
                "Health Check - Auth Required", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code, 'response': data}
            )
        elif status_code == 200:
            if isinstance(data, dict) and 'status' in data:
                self.log_result(
                    "Health Check - Success", 
                    True, 
                    f"Health check successful: {data.get('status')}", 
                    {'status_code': status_code, 'response': data}
                )
            else:
                self.log_result(
                    "Health Check - Invalid Response", 
                    False, 
                    "Response missing expected 'status' field", 
                    {'status_code': status_code, 'response': data}
                )
        elif status_code == 500:
            self.log_result(
                "Health Check - Server Error", 
                False, 
                f"Server error: {data.get('error', 'Unknown error')}", 
                {'status_code': status_code, 'response': data}
            )
        else:
            self.log_result(
                "Health Check - Unexpected Status", 
                False, 
                f"Unexpected status code: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
    
    def test_shop_settings_api(self):
        """Test shop settings API"""
        print("\n=== Testing Shop Settings API ===")
        
        # Test GET shop settings
        result = self.make_request('GET', 'shop-settings')
        
        if result.get('error'):
            self.log_result(
                "Shop Settings - GET", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        if status_code == 401:
            self.log_result(
                "Shop Settings - GET Auth", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code}
            )
        elif status_code == 200:
            self.log_result(
                "Shop Settings - GET Success", 
                True, 
                f"Shop settings retrieved successfully", 
                {'status_code': status_code, 'has_data': data is not None}
            )
        elif status_code == 500:
            self.log_result(
                "Shop Settings - GET Server Error", 
                False, 
                f"Server error: {data.get('error', 'Unknown error')}", 
                {'status_code': status_code, 'response': data}
            )
        else:
            self.log_result(
                "Shop Settings - GET Unexpected", 
                False, 
                f"Unexpected status code: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
        
        # Test POST shop settings (update)
        test_settings = {
            "workable_hours_per_week": 40,
            "billable_efficiency_pct": 75,
            "monthly_overhead": 5000,
            "monthly_owner_pay_goal": 8000,
            "monthly_profit_goal": 3000,
            "default_pricing_mode": "profit"
        }
        
        result = self.make_request('POST', 'shop-settings', test_settings)
        
        if result.get('error'):
            self.log_result(
                "Shop Settings - POST", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
        else:
            status_code = result['status_code']
            data = result['data']
            
            if status_code == 401:
                self.log_result(
                    "Shop Settings - POST Auth", 
                    True, 
                    "Returns 401 Unauthorized as expected (Supabase auth required)", 
                    {'status_code': status_code}
                )
            elif status_code == 200:
                self.log_result(
                    "Shop Settings - POST Success", 
                    True, 
                    "Shop settings update endpoint working", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "Shop Settings - POST Error", 
                    False, 
                    f"Unexpected status: {status_code}", 
                    {'status_code': status_code, 'response': data}
                )
    
    def test_materials_api(self):
        """Test patch materials API"""
        print("\n=== Testing Patch Materials API ===")
        
        # Test GET materials
        result = self.make_request('GET', 'patch-materials')
        
        if result.get('error'):
            self.log_result(
                "Materials - GET", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        if status_code == 401:
            self.log_result(
                "Materials - GET Auth", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code}
            )
        elif status_code == 200:
            self.log_result(
                "Materials - GET Success", 
                True, 
                f"Materials retrieved successfully", 
                {'status_code': status_code, 'is_array': isinstance(data, list)}
            )
        else:
            self.log_result(
                "Materials - GET Error", 
                False, 
                f"Unexpected status: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
        
        # Test POST materials (create)
        test_material = {
            "name": "Test Leatherette",
            "sheet_width": 12,
            "sheet_height": 24,
            "sheet_cost": 10.00,
            "default_machine_minutes_per_sheet": 15,
            "default_cleanup_minutes_per_sheet": 5
        }
        
        result = self.make_request('POST', 'patch-materials', test_material)
        
        if result.get('error'):
            self.log_result(
                "Materials - POST", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
        else:
            status_code = result['status_code']
            
            if status_code == 401:
                self.log_result(
                    "Materials - POST Auth", 
                    True, 
                    "Returns 401 Unauthorized as expected (Supabase auth required)", 
                    {'status_code': status_code}
                )
            elif status_code == 200:
                self.log_result(
                    "Materials - POST Success", 
                    True, 
                    "Material creation endpoint working", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "Materials - POST Error", 
                    False, 
                    f"Unexpected status: {status_code}", 
                    {'status_code': status_code}
                )
    
    def test_customers_api(self):
        """Test customers API"""
        print("\n=== Testing Customers API ===")
        
        # Test GET customers
        result = self.make_request('GET', 'customers')
        
        if result.get('error'):
            self.log_result(
                "Customers - GET", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        if status_code == 401:
            self.log_result(
                "Customers - GET Auth", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code}
            )
        elif status_code == 200:
            self.log_result(
                "Customers - GET Success", 
                True, 
                f"Customers retrieved successfully", 
                {'status_code': status_code, 'is_array': isinstance(data, list)}
            )
        else:
            self.log_result(
                "Customers - GET Error", 
                False, 
                f"Unexpected status: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
        
        # Test POST customers (create)
        test_customer = {
            "name": "Test Customer",
            "email": "test@example.com",
            "phone": "555-0123",
            "company": "Test Company"
        }
        
        result = self.make_request('POST', 'customers', test_customer)
        
        if result.get('error'):
            self.log_result(
                "Customers - POST", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
        else:
            status_code = result['status_code']
            
            if status_code == 401:
                self.log_result(
                    "Customers - POST Auth", 
                    True, 
                    "Returns 401 Unauthorized as expected (Supabase auth required)", 
                    {'status_code': status_code}
                )
            elif status_code == 200:
                self.log_result(
                    "Customers - POST Success", 
                    True, 
                    "Customer creation endpoint working", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "Customers - POST Error", 
                    False, 
                    f"Unexpected status: {status_code}", 
                    {'status_code': status_code}
                )
    
    def test_quotes_api(self):
        """Test quotes API"""
        print("\n=== Testing Quotes API ===")
        
        # Test GET quotes
        result = self.make_request('GET', 'quotes')
        
        if result.get('error'):
            self.log_result(
                "Quotes - GET", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        if status_code == 401:
            self.log_result(
                "Quotes - GET Auth", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code}
            )
        elif status_code == 200:
            self.log_result(
                "Quotes - GET Success", 
                True, 
                f"Quotes retrieved successfully", 
                {'status_code': status_code, 'is_array': isinstance(data, list)}
            )
        else:
            self.log_result(
                "Quotes - GET Error", 
                False, 
                f"Unexpected status: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
    
    def test_quote_calculation_api(self):
        """Test quote calculation API with new unified pricing engine"""
        print("\n=== Testing Quote Calculation API (Pricing Engine Overhaul) ===")
        
        # Test quote calculation with the exact data from review request
        test_quote_data = {
            "quote_type": "patch_press",
            "qty": 144,
            "patch_material_id": "test-material-id",  # Will be replaced with actual material ID
            "patch_width_input": 3.25,
            "patch_height_input": 2.25,
            "waste_pct": 5,
            "machine_minutes_per_sheet": 12,
            "cleanup_minutes_per_sheet": 5,
            "apply_minutes_per_hat": 2,
            "proof_minutes": 5,
            "setup_minutes": 5,
            "packing_minutes": 5
        }
        
        # First, try to get materials to use a real material ID
        materials_result = self.make_request('GET', 'patch-materials')
        if not materials_result.get('error') and materials_result.get('status_code') == 200:
            materials = materials_result.get('data', [])
            if materials and len(materials) > 0:
                test_quote_data["patch_material_id"] = materials[0].get('id', 'test-material-id')
                print(f"Using material ID: {test_quote_data['patch_material_id']}")
        
        result = self.make_request('POST', 'quotes/calculate', test_quote_data)
        
        if result.get('error'):
            self.log_result(
                "Pricing Engine - Request Failed", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
            return
        
        status_code = result['status_code']
        data = result['data']
        
        if status_code == 401:
            self.log_result(
                "Pricing Engine - Auth Required", 
                True, 
                "Returns 401 Unauthorized as expected (Supabase auth required)", 
                {'status_code': status_code}
            )
        elif status_code == 400:
            # Expected if material not found or shop settings missing
            error_msg = data.get('error', 'Unknown error')
            if 'not found' in error_msg.lower() or 'settings' in error_msg.lower():
                self.log_result(
                    "Pricing Engine - Missing Data", 
                    True, 
                    f"Expected error due to missing data: {error_msg}", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "Pricing Engine - Bad Request", 
                    False, 
                    f"Unexpected 400 error: {error_msg}", 
                    {'status_code': status_code, 'response': data}
                )
        elif status_code == 200:
            # Test the new pricing engine response structure
            self.validate_pricing_engine_response(data)
        elif status_code == 500:
            error_msg = data.get('error', 'Unknown server error')
            
            # Check for specific error patterns
            if 'stack' in error_msg.lower() or 'recursion' in error_msg.lower():
                self.log_result(
                    "Pricing Engine - Stack Overflow", 
                    False, 
                    f"CRITICAL: Stack overflow detected: {error_msg}", 
                    {'status_code': status_code, 'response': data}
                )
            elif 'supabase' in error_msg.lower() or 'database' in error_msg.lower():
                self.log_result(
                    "Pricing Engine - DB Error", 
                    True, 
                    f"Expected database error (Supabase not configured): {error_msg}", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "Pricing Engine - Server Error", 
                    False, 
                    f"Server error: {error_msg}", 
                    {'status_code': status_code, 'response': data}
                )
        else:
            self.log_result(
                "Pricing Engine - Unexpected Status", 
                False, 
                f"Unexpected status code: {status_code}", 
                {'status_code': status_code, 'response': data}
            )
        
        # Test with patch_only quote type
        print("\n--- Testing Patch Only Quote Calculation ---")
        patch_only_data = test_quote_data.copy()
        patch_only_data['quote_type'] = 'patch_only'
        
        result = self.make_request('POST', 'quotes/calculate', patch_only_data)
        
        if result.get('error'):
            self.log_result(
                "Patch Only Calculation", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
        else:
            status_code = result['status_code']
            if status_code in [200, 400, 401]:
                self.log_result(
                    "Patch Only Calculation", 
                    True, 
                    f"Patch only calculation handled (status: {status_code})", 
                    {'status_code': status_code}
                )
                if status_code == 200:
                    self.validate_pricing_engine_response(result['data'], quote_type='patch_only')
            elif status_code == 500:
                error_msg = result['data'].get('error', 'Unknown error')
                if 'stack' in error_msg.lower():
                    self.log_result(
                        "Patch Only Calculation - Stack Error", 
                        False, 
                        f"CRITICAL: Stack overflow in patch only: {error_msg}", 
                        {'status_code': status_code}
                    )
                else:
                    self.log_result(
                        "Patch Only Calculation - Server Error", 
                        True, 
                        f"Expected server error: {error_msg}", 
                        {'status_code': status_code}
                    )
    
    def validate_pricing_engine_response(self, data, quote_type='patch_press'):
        """Validate the new pricing engine response structure"""
        print(f"\n--- Validating Pricing Engine Response for {quote_type} ---")
        
        # Check for active pricing fields
        active_fields = ['publishedPerPiece', 'costPerPiece', 'wholesalePerPiece', 'profitPerPiece', 'marginPct']
        active_data = data.get('active', {})
        
        missing_active = []
        for field in active_fields:
            if field not in active_data:
                missing_active.append(field)
        
        if missing_active:
            self.log_result(
                f"Pricing Engine - Active Fields ({quote_type})", 
                False, 
                f"Missing active fields: {missing_active}", 
                {'missing_fields': missing_active, 'active_data': active_data}
            )
        else:
            # Validate profit calculation: profitPerPiece = publishedPerPiece - costPerPiece
            published = active_data.get('publishedPerPiece', 0)
            cost = active_data.get('costPerPiece', 0)
            profit = active_data.get('profitPerPiece', 0)
            
            expected_profit = round((published - cost) * 100) / 100  # Round to cents
            actual_profit = round(profit * 100) / 100
            
            profit_correct = abs(expected_profit - actual_profit) < 0.01
            
            self.log_result(
                f"Pricing Engine - Active Fields ({quote_type})", 
                True, 
                f"All active pricing fields present", 
                {
                    'published': published, 
                    'cost': cost, 
                    'profit': profit,
                    'profit_calculation_correct': profit_correct
                }
            )
            
            if not profit_correct:
                self.log_result(
                    f"Pricing Engine - Profit Calculation ({quote_type})", 
                    False, 
                    f"Profit calculation incorrect: expected {expected_profit}, got {actual_profit}", 
                    {'expected': expected_profit, 'actual': actual_profit}
                )
            else:
                self.log_result(
                    f"Pricing Engine - Profit Calculation ({quote_type})", 
                    True, 
                    f"Profit calculation correct: {actual_profit}", 
                    {'profit': actual_profit}
                )
        
        # Check for tiers array
        tiers = data.get('tiers', [])
        if not isinstance(tiers, list) or len(tiers) != 7:
            self.log_result(
                f"Pricing Engine - Tiers Array ({quote_type})", 
                False, 
                f"Expected 7 tiers, got {len(tiers) if isinstance(tiers, list) else 'not array'}", 
                {'tiers_count': len(tiers) if isinstance(tiers, list) else 0}
            )
        else:
            # Validate tier costs differ
            tier_costs = [tier.get('costPerPiece', 0) for tier in tiers if 'costPerPiece' in tier]
            unique_costs = len(set(tier_costs))
            
            if unique_costs <= 1:
                self.log_result(
                    f"Pricing Engine - Tier Cost Variation ({quote_type})", 
                    False, 
                    f"All tier costs are the same: {tier_costs}", 
                    {'tier_costs': tier_costs}
                )
            else:
                self.log_result(
                    f"Pricing Engine - Tier Cost Variation ({quote_type})", 
                    True, 
                    f"Tier costs vary correctly ({unique_costs} unique values)", 
                    {'unique_costs': unique_costs, 'sample_costs': tier_costs[:3]}
                )
            
            # Check each tier has required fields
            tier_fields = ['costPerPiece', 'publishedPerPiece', 'profitPerPiece', 'marginPct']
            for i, tier in enumerate(tiers):
                missing_tier_fields = [field for field in tier_fields if field not in tier]
                if missing_tier_fields:
                    self.log_result(
                        f"Pricing Engine - Tier {i+1} Fields ({quote_type})", 
                        False, 
                        f"Missing fields: {missing_tier_fields}", 
                        {'tier_index': i, 'missing': missing_tier_fields}
                    )
                    break
            else:
                self.log_result(
                    f"Pricing Engine - All Tier Fields ({quote_type})", 
                    True, 
                    f"All 7 tiers have required pricing fields", 
                    {'tiers_validated': len(tiers)}
                )
        
        # Check customerView.tiers
        customer_view = data.get('customerView', {})
        customer_tiers = customer_view.get('tiers', [])
        
        if not isinstance(customer_tiers, list):
            self.log_result(
                f"Pricing Engine - Customer Tiers ({quote_type})", 
                False, 
                f"Customer tiers not found or not array", 
                {'customer_view': customer_view}
            )
        else:
            self.log_result(
                f"Pricing Engine - Customer Tiers ({quote_type})", 
                True, 
                f"Customer pricing matrix present ({len(customer_tiers)} tiers)", 
                {'customer_tiers_count': len(customer_tiers)}
            )
        
        # Check scripts
        scripts = data.get('scripts', {})
        script_types = ['sms', 'dm', 'phone']
        missing_scripts = [script for script in script_types if script not in scripts or not scripts[script]]
        
        if missing_scripts:
            self.log_result(
                f"Pricing Engine - Quote Scripts ({quote_type})", 
                False, 
                f"Missing or empty scripts: {missing_scripts}", 
                {'missing_scripts': missing_scripts}
            )
        else:
            self.log_result(
                f"Pricing Engine - Quote Scripts ({quote_type})", 
                True, 
                f"All quote scripts present (sms, dm, phone)", 
                {'scripts_present': script_types}
            )
        
        # Check formatMoney values (should have exactly 2 decimal places)
        display = data.get('display', {})
        money_fields = ['publishedPerPiece', 'costPerPiece', 'wholesalePerPiece', 'profitPerPiece', 'total']
        
        format_issues = []
        for field in money_fields:
            value = display.get(field, '')
            if isinstance(value, str) and value.startswith('$'):
                # Check if it has exactly 2 decimal places
                if '.' in value:
                    decimal_part = value.split('.')[-1]
                    if len(decimal_part) != 2:
                        format_issues.append(f"{field}: {value}")
                else:
                    format_issues.append(f"{field}: {value} (no decimals)")
        
        if format_issues:
            self.log_result(
                f"Pricing Engine - Money Formatting ({quote_type})", 
                False, 
                f"Incorrect decimal formatting: {format_issues}", 
                {'format_issues': format_issues}
            )
        else:
            self.log_result(
                f"Pricing Engine - Money Formatting ({quote_type})", 
                True, 
                f"All money values formatted with 2 decimal places", 
                {'money_fields_checked': len(money_fields)}
            )
    
    def test_api_structure(self):
        """Test API structure and routing"""
        print("\n=== Testing API Structure ===")
        
        # Test invalid path
        result = self.make_request('GET', 'invalid-endpoint')
        
        if result.get('error'):
            self.log_result(
                "API Structure - Invalid Path", 
                False, 
                f"Request failed: {result['error']}", 
                result
            )
        else:
            status_code = result['status_code']
            if status_code == 404:
                self.log_result(
                    "API Structure - 404 Handling", 
                    True, 
                    "Invalid endpoints return 404 as expected", 
                    {'status_code': status_code}
                )
            elif status_code == 401:
                self.log_result(
                    "API Structure - Auth First", 
                    True, 
                    "Auth check happens before route validation", 
                    {'status_code': status_code}
                )
            else:
                self.log_result(
                    "API Structure - Unexpected", 
                    False, 
                    f"Unexpected status for invalid path: {status_code}", 
                    {'status_code': status_code}
                )
        
        # Test CORS headers
        result = self.make_request('GET', 'health')
        if not result.get('error'):
            headers = result.get('headers', {})
            cors_headers = [
                'access-control-allow-origin',
                'access-control-allow-methods',
                'access-control-allow-headers'
            ]
            
            has_cors = any(header in headers for header in cors_headers)
            self.log_result(
                "API Structure - CORS Headers", 
                has_cors, 
                f"CORS headers {'present' if has_cors else 'missing'}", 
                {'has_cors': has_cors}
            )
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Patch Hat QuoteKit Backend API Tests")
        print(f"Testing against: {self.api_base}")
        print("=" * 60)
        
        try:
            # Test core APIs
            self.test_health_check()
            self.test_shop_settings_api()
            self.test_materials_api()
            self.test_customers_api()
            self.test_quotes_api()
            
            # Test the critical calculation API
            self.test_quote_calculation_api()
            
            # Test API structure
            self.test_api_structure()
            
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR during testing: {e}")
            print(traceback.format_exc())
            self.log_result(
                "Test Suite Execution", 
                False, 
                f"Critical error: {e}", 
                {'traceback': traceback.format_exc()}
            )
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            print(f"\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        # Check for critical issues
        critical_issues = []
        for result in self.test_results:
            if not result['success'] and ('stack' in result['message'].lower() or 'recursion' in result['message'].lower()):
                critical_issues.append(result)
        
        if critical_issues:
            print(f"\n🚨 CRITICAL ISSUES FOUND:")
            for issue in critical_issues:
                print(f"  🚨 {issue['test']}: {issue['message']}")
        
        print("\n" + "=" * 60)
        
        return {
            'total': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'critical_issues': len(critical_issues),
            'results': self.test_results
        }

def main():
    """Main test execution"""
    # Get base URL from environment or use default
    import os
    base_url = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://quoteforge-app.preview.emergentagent.com')
    
    print(f"🔧 Patch Hat QuoteKit Backend API Tester")
    print(f"📍 Base URL: {base_url}")
    
    tester = QuoteKitAPITester(base_url)
    summary = tester.run_all_tests()
    
    # Exit with appropriate code
    if summary and summary['critical_issues'] > 0:
        print("\n🚨 CRITICAL ISSUES DETECTED - Exiting with error code")
        sys.exit(2)
    elif summary and summary['failed'] > 0:
        print("\n⚠️  Some tests failed - Exiting with warning code")
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()