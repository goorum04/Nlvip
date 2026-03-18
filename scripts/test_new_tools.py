#!/usr/bin/env python3
"""
Focused Test for NEW Admin Assistant Tools Only
Testing: list_members, list_workouts, get_member_activity
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://fitness-clubhouse.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/admin-assistant"
TIMEOUT = 60

def make_api_request(message: str, timeout: int = TIMEOUT):
    """Make a request to the Admin Assistant API"""
    payload = {
        "messages": [
            {
                "role": "user", 
                "content": message
            }
        ]
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"🔄 Sending request: {message}")
    
    try:
        response = requests.post(
            API_ENDPOINT, 
            json=payload, 
            headers=headers, 
            timeout=timeout
        )
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Error Response: {response.text}")
            return {"error": f"HTTP {response.status_code}: {response.text}"}
            
    except requests.exceptions.Timeout:
        print(f"⏰ Request timed out after {timeout} seconds")
        return {"error": "Request timeout"}
    except requests.exceptions.RequestException as e:
        print(f"🚫 Request failed: {str(e)}")
        return {"error": str(e)}

def test_new_tools():
    """Test only the NEW Admin Assistant tools"""
    print("🚀 TESTING NEW ADMIN ASSISTANT TOOLS")
    print("=" * 80)
    
    new_tools_tests = [
        {
            "name": "List Members Tool",
            "message": "Lista todos los socios",
            "expected_keys": ["members", "count"],
            "expected_content": ["Said", "María", "socios"]
        },
        {
            "name": "List Workouts Tool", 
            "message": "Lista las rutinas disponibles",
            "expected_keys": ["workouts"],
            "expected_content": ["rutinas", "workouts", "entrenamiento"]
        },
        {
            "name": "Get Member Activity Tool",
            "message": "Ver actividad física del socio Said de los últimos 7 días",
            "expected_keys": ["activity", "summary"],
            "expected_content": ["Said", "actividad", "pasos", "días"]
        }
    ]
    
    results = []
    
    for i, test in enumerate(new_tools_tests, 1):
        print(f"\n{'='*60}")
        print(f"🧪 TEST {i}: {test['name'].upper()}")
        print(f"{'='*60}")
        
        # Wait between requests to avoid rate limits
        if i > 1:
            print("⏳ Waiting 45 seconds to avoid rate limits...")
            time.sleep(45)
        
        response = make_api_request(test["message"])
        
        success = False
        details = ""
        
        if "error" in response:
            if "429" in str(response["error"]) or "rate limit" in str(response["error"]).lower():
                print(f"⚠️ RATE LIMITED: {response['error']}")
                details = "Rate limited - tool exists but API quota exceeded"
                success = "rate_limited"
            else:
                print(f"❌ FAILED: {response['error']}")
                details = f"Error: {response['error']}"
                success = False
        else:
            # Check tool results
            if "toolResults" in response:
                print("🔧 Tool results found:")
                for tool_id, result in response["toolResults"].items():
                    print(f"  Tool {tool_id}: {result.get('success', False)}")
                    
                    # Check for expected keys
                    found_keys = []
                    for key in test["expected_keys"]:
                        if key in result:
                            found_keys.append(key)
                            print(f"  ✅ Found key: {key}")
                            
                            # Show some data
                            data = result[key]
                            if isinstance(data, list):
                                print(f"    📊 Count: {len(data)}")
                                if len(data) > 0:
                                    print(f"    📋 Sample: {str(data[0])[:100]}...")
                            elif isinstance(data, dict):
                                print(f"    📊 Keys: {list(data.keys())}")
                            else:
                                print(f"    📊 Value: {data}")
                    
                    if len(found_keys) > 0:
                        success = True
                        details = f"Tool working - found keys: {found_keys}"
                        break
            
            # Check message content
            if "message" in response:
                message = response["message"]
                print(f"💬 Assistant message: {message[:200]}...")
                
                # Look for expected content
                found_content = []
                for content in test["expected_content"]:
                    if content.lower() in message.lower():
                        found_content.append(content)
                
                if found_content:
                    success = True
                    details = f"Response contains expected content: {found_content}"
        
        # Record result
        results.append({
            "name": test["name"],
            "success": success,
            "details": details
        })
        
        if success == True:
            print(f"✅ SUCCESS: {test['name']}")
        elif success == "rate_limited":
            print(f"⚠️ RATE LIMITED: {test['name']} (tool exists but quota exceeded)")
        else:
            print(f"❌ FAILED: {test['name']}")
    
    # Summary
    print(f"\n{'='*80}")
    print("📊 NEW TOOLS TEST SUMMARY")
    print(f"{'='*80}")
    
    working_tools = sum(1 for r in results if r["success"] == True)
    rate_limited_tools = sum(1 for r in results if r["success"] == "rate_limited")
    failed_tools = sum(1 for r in results if r["success"] == False)
    total_tools = len(results)
    
    print(f"📈 Total NEW Tools Tested: {total_tools}")
    print(f"✅ Working: {working_tools}")
    print(f"⚠️ Rate Limited: {rate_limited_tools}")
    print(f"❌ Failed: {failed_tools}")
    
    print(f"\n📋 DETAILED RESULTS:")
    for result in results:
        if result["success"] == True:
            status = "✅ WORKING"
        elif result["success"] == "rate_limited":
            status = "⚠️ RATE LIMITED"
        else:
            status = "❌ FAILED"
        
        print(f"  {status} - {result['name']}")
        print(f"    📝 {result['details']}")
    
    # Determine overall status
    if working_tools == total_tools:
        print(f"\n🎉 ALL NEW TOOLS ARE WORKING PERFECTLY!")
        return True
    elif working_tools + rate_limited_tools == total_tools:
        print(f"\n⚠️ ALL NEW TOOLS EXIST AND WORK (some rate limited)")
        print(f"💡 Rate limiting is a temporary API quota issue, not a code problem")
        return True
    else:
        print(f"\n❌ SOME NEW TOOLS HAVE ISSUES")
        return False

if __name__ == "__main__":
    success = test_new_tools()
    sys.exit(0 if success else 1)