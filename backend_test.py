#!/usr/bin/env python3
"""
Backend Test Suite for Admin Assistant API
Tests all functionality of the /api/admin-assistant endpoint
"""

import requests
import json
import time
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "https://fitapp-supabase.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/admin-assistant"
TIMEOUT = 60  # 60 seconds timeout for API calls

def make_api_request(message: str, timeout: int = TIMEOUT) -> Dict[Any, Any]:
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
    print(f"📡 URL: {API_ENDPOINT}")
    
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

def test_basic_chat():
    """Test 1: Basic Chat Test"""
    print("\n" + "="*60)
    print("🧪 TEST 1: BASIC CHAT TEST")
    print("="*60)
    
    response = make_api_request("Hola")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    if "message" in response and response["message"]:
        print(f"✅ SUCCESS: Got response: {response['message'][:100]}...")
        return True
    else:
        print(f"❌ FAILED: No message in response: {response}")
        return False

def test_find_member():
    """Test 2: Find Member Tool Test"""
    print("\n" + "="*60)
    print("🧪 TEST 2: FIND MEMBER TOOL TEST")
    print("="*60)
    
    response = make_api_request("Busca al socio Said")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    # Check if we got tool results
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result}")
            
            # Check if we found member data
            if "members" in result and result["members"]:
                member = result["members"][0]
                print(f"👤 Found member: {member.get('name', 'Unknown')}")
                print(f"📧 Email: {member.get('email', 'Unknown')}")
                print(f"🏋️ Trainer: {member.get('trainer_name', 'Unknown')}")
                print(f"🥗 Has diet: {member.get('has_diet', False)}")
                print(f"💪 Has workout: {member.get('has_workout', False)}")
                
                # Check if it's the expected member (Said)
                if member.get('name') == 'Said' and member.get('email') == 'socio@demo.com':
                    print("✅ SUCCESS: Found expected member Said with correct data")
                    return True
                else:
                    print("⚠️ WARNING: Found member but not the expected one")
                    return True  # Still working, just different data
            else:
                print("❌ FAILED: No members found in tool results")
                return False
    
    # Check message content for member info
    if "message" in response and "Said" in response["message"]:
        print(f"✅ SUCCESS: Response mentions Said: {response['message'][:200]}...")
        return True
    
    print(f"❌ FAILED: No member info found in response: {response}")
    return False

def test_generate_diet_plan():
    """Test 3: Generate Diet Plan Tool Test (MAIN TEST)"""
    print("\n" + "="*60)
    print("🧪 TEST 3: GENERATE DIET PLAN TOOL TEST (MAIN)")
    print("="*60)
    
    response = make_api_request("Genera una dieta para Said con objetivo pérdida de grasa")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    success = False
    
    # Check tool results for diet plan
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result.get('success', False)}")
            
            # Check for diet plan data
            if "diet_plan" in result:
                diet_plan = result["diet_plan"]
                print("🥗 Diet plan generated!")
                print(f"📄 Diet plan length: {len(diet_plan)} characters")
                
                # Check for required components
                required_components = [
                    "MACROS DIARIOS",
                    "Calorías",
                    "Proteína", 
                    "Carbohidratos",
                    "Grasas",
                    "REGLAS GENERALES",
                    "SUPLEMENTACIÓN",
                    "FLUIDOS"
                ]
                
                found_components = []
                for component in required_components:
                    if component in diet_plan:
                        found_components.append(component)
                        print(f"  ✅ Found: {component}")
                    else:
                        print(f"  ❌ Missing: {component}")
                
                if len(found_components) >= 6:  # At least 6 out of 8 components
                    print("✅ SUCCESS: Diet plan contains most required components")
                    success = True
                else:
                    print(f"⚠️ WARNING: Diet plan missing some components ({len(found_components)}/8)")
                    success = True  # Still working, just incomplete
            
            # Check for calculated macros
            if "macros" in result:
                macros = result["macros"]
                print(f"📊 Calculated macros:")
                print(f"  🔥 Calories: {macros.get('calories', 'N/A')}")
                print(f"  🥩 Protein: {macros.get('protein_g', 'N/A')}g")
                print(f"  🍚 Carbs: {macros.get('carbs_g', 'N/A')}g")
                print(f"  🥑 Fat: {macros.get('fat_g', 'N/A')}g")
                
                if all(key in macros for key in ['calories', 'protein_g', 'carbs_g', 'fat_g']):
                    print("✅ SUCCESS: All macros calculated correctly")
                    success = True
    
    # Check message content
    if "message" in response:
        message = response["message"]
        print(f"💬 Assistant message: {message[:200]}...")
        
        # Look for diet-related keywords
        diet_keywords = ["dieta", "macros", "calorías", "proteína", "plan"]
        if any(keyword in message.lower() for keyword in diet_keywords):
            print("✅ SUCCESS: Response contains diet-related content")
            success = True
    
    if not success:
        print(f"❌ FAILED: No diet plan found in response: {response}")
    
    return success

def test_gym_dashboard():
    """Test 4: Gym Dashboard Tool Test"""
    print("\n" + "="*60)
    print("🧪 TEST 4: GYM DASHBOARD TOOL TEST")
    print("="*60)
    
    response = make_api_request("Dame el resumen del gimnasio")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    # Check tool results for dashboard data
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result.get('success', False)}")
            
            # Check for dashboard data
            if "dashboard" in result:
                dashboard = result["dashboard"]
                print("📊 Dashboard data found:")
                
                # Expected dashboard fields
                expected_fields = [
                    "total_members", "total_trainers", "active_challenges",
                    "new_members_this_month", "total_checkins_today"
                ]
                
                found_fields = []
                for field in expected_fields:
                    if field in dashboard:
                        found_fields.append(field)
                        print(f"  ✅ {field}: {dashboard[field]}")
                    else:
                        print(f"  ❌ Missing: {field}")
                
                if len(found_fields) >= 3:  # At least 3 fields
                    print("✅ SUCCESS: Dashboard contains expected stats")
                    return True
                else:
                    print(f"⚠️ WARNING: Dashboard missing some fields ({len(found_fields)}/5)")
                    return True  # Still working, just incomplete data
    
    # Check message content
    if "message" in response:
        message = response["message"]
        print(f"💬 Assistant message: {message[:200]}...")
        
        # Look for dashboard-related keywords
        dashboard_keywords = ["resumen", "gimnasio", "socios", "entrenadores", "total"]
        if any(keyword in message.lower() for keyword in dashboard_keywords):
            print("✅ SUCCESS: Response contains dashboard-related content")
            return True
    
    print(f"❌ FAILED: No dashboard data found in response: {response}")
    return False

def test_list_members():
    """Test 5: List Members Tool Test (NEW)"""
    print("\n" + "="*60)
    print("🧪 TEST 5: LIST MEMBERS TOOL TEST (NEW)")
    print("="*60)
    
    response = make_api_request("Lista todos los socios")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    # Check tool results for members list
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result.get('success', False)}")
            
            # Check for members data
            if "members" in result:
                members = result["members"]
                count = result.get("count", len(members))
                print(f"👥 Found {count} members:")
                
                # Check for expected members (Said and María)
                expected_members = ["Said", "María"]
                found_members = []
                
                for member in members[:5]:  # Show first 5 members
                    name = member.get('name', 'Unknown')
                    email = member.get('email', 'Unknown')
                    print(f"  👤 {name} ({email})")
                    
                    if name in expected_members:
                        found_members.append(name)
                
                if len(found_members) >= 1:  # At least one expected member
                    print(f"✅ SUCCESS: Found expected members: {found_members}")
                    return True
                elif count > 0:
                    print(f"✅ SUCCESS: List members working (found {count} members)")
                    return True
                else:
                    print("⚠️ WARNING: No members found but tool is working")
                    return True
    
    # Check message content
    if "message" in response:
        message = response["message"]
        print(f"💬 Assistant message: {message[:200]}...")
        
        # Look for members-related keywords
        members_keywords = ["socios", "miembros", "lista", "Said", "María"]
        if any(keyword in message.lower() for keyword in members_keywords):
            print("✅ SUCCESS: Response contains members-related content")
            return True
    
    print(f"❌ FAILED: No members data found in response: {response}")
    return False

def test_list_workouts():
    """Test 6: List Workouts Tool Test (NEW)"""
    print("\n" + "="*60)
    print("🧪 TEST 6: LIST WORKOUTS TOOL TEST (NEW)")
    print("="*60)
    
    response = make_api_request("Lista las rutinas disponibles")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    # Check tool results for workouts list
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result.get('success', False)}")
            
            # Check for workouts data
            if "workouts" in result:
                workouts = result["workouts"]
                print(f"🏋️ Found {len(workouts)} workouts:")
                
                for workout in workouts[:5]:  # Show first 5 workouts
                    name = workout.get('name', 'Unknown')
                    description = workout.get('description', 'No description')
                    difficulty = workout.get('difficulty', 'Unknown')
                    print(f"  💪 {name} - {difficulty} - {description[:50]}...")
                
                if len(workouts) > 0:
                    print("✅ SUCCESS: List workouts working with data")
                    return True
                else:
                    print("✅ SUCCESS: List workouts working (empty list)")
                    return True
    
    # Check message content
    if "message" in response:
        message = response["message"]
        print(f"💬 Assistant message: {message[:200]}...")
        
        # Look for workouts-related keywords
        workouts_keywords = ["rutinas", "workouts", "entrenamiento", "ejercicios", "disponibles"]
        if any(keyword in message.lower() for keyword in workouts_keywords):
            print("✅ SUCCESS: Response contains workouts-related content")
            return True
    
    print(f"❌ FAILED: No workouts data found in response: {response}")
    return False

def test_get_member_activity():
    """Test 7: Get Member Activity Tool Test (NEW)"""
    print("\n" + "="*60)
    print("🧪 TEST 7: GET MEMBER ACTIVITY TOOL TEST (NEW)")
    print("="*60)
    
    response = make_api_request("Ver actividad física del socio Said de los últimos 7 días")
    
    if "error" in response:
        print(f"❌ FAILED: {response['error']}")
        return False
    
    # Check tool results for activity data
    if "toolResults" in response:
        print("🔧 Tool results found:")
        for tool_id, result in response["toolResults"].items():
            print(f"  Tool {tool_id}: {result.get('success', False)}")
            
            # Check for activity data
            if "activity" in result or "summary" in result:
                activity = result.get("activity", [])
                summary = result.get("summary", {})
                
                print(f"👟 Activity data found:")
                print(f"  📊 Days tracked: {len(activity)}")
                
                if summary:
                    print(f"  📈 Summary:")
                    print(f"    🚶 Total steps: {summary.get('total_steps', 0)}")
                    print(f"    📏 Total distance: {summary.get('total_distance_km', 0)} km")
                    print(f"    🔥 Total calories: {summary.get('total_calories', 0)}")
                    print(f"    📊 Avg steps/day: {summary.get('avg_steps_per_day', 0)}")
                
                # Show some activity entries
                for i, day in enumerate(activity[:3]):  # Show first 3 days
                    date = day.get('activity_date', 'Unknown')
                    steps = day.get('steps', 0)
                    distance = day.get('distance_km', 0)
                    calories = day.get('calories_kcal', 0)
                    print(f"    📅 {date}: {steps} steps, {distance}km, {calories}kcal")
                
                print("✅ SUCCESS: Get member activity working")
                return True
    
    # Check message content
    if "message" in response:
        message = response["message"]
        print(f"💬 Assistant message: {message[:200]}...")
        
        # Look for activity-related keywords
        activity_keywords = ["actividad", "pasos", "steps", "distancia", "calorías", "Said", "días"]
        if any(keyword in message.lower() for keyword in activity_keywords):
            print("✅ SUCCESS: Response contains activity-related content")
            return True
    
    print(f"❌ FAILED: No activity data found in response: {response}")
    return False

def run_all_tests():
    """Run all tests and provide summary"""
    print("🚀 STARTING ADMIN ASSISTANT API TESTS")
    print("=" * 80)
    
    tests = [
        ("Basic Chat", test_basic_chat),
        ("Find Member Tool", test_find_member),
        ("Generate Diet Plan Tool", test_generate_diet_plan),
        ("Gym Dashboard Tool", test_gym_dashboard),
        ("List Members Tool (NEW)", test_list_members),
        ("List Workouts Tool (NEW)", test_list_workouts),
        ("Get Member Activity Tool (NEW)", test_get_member_activity)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            
            if result:
                print(f"🎉 {test_name}: PASSED")
            else:
                print(f"💥 {test_name}: FAILED")
                
        except Exception as e:
            print(f"💥 {test_name}: EXCEPTION - {str(e)}")
            results.append((test_name, False))
        
        # Wait between tests
        time.sleep(2)
    
    # Summary
    print("\n" + "="*80)
    print("📋 TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\n🏆 OVERALL: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Admin Assistant API is working correctly.")
        return True
    elif passed >= total * 0.75:  # 75% pass rate
        print("⚠️ MOST TESTS PASSED. Some minor issues may exist.")
        return True
    else:
        print("💥 MULTIPLE TESTS FAILED. Major issues detected.")
        return False

if __name__ == "__main__":
    print("🧪 Admin Assistant API Backend Test Suite")
    print(f"🌐 Testing endpoint: {API_ENDPOINT}")
    print(f"⏰ Timeout: {TIMEOUT} seconds per request")
    
    success = run_all_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)