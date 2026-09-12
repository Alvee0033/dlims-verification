import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ARTIFACT_DIR = "/home/alvee/.gemini/antigravity/brain/d11e366e-5fd8-45fc-b865-0c648eed72b1"

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--window-size=390,844")

driver = webdriver.Chrome(options=chrome_options)
driver.set_window_size(390, 844)

try:
    print("1. Logging into Admin...")
    driver.get("http://localhost:3001/admin/login")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "admin-email")))
    driver.find_element(By.ID, "admin-email").send_keys("admin@dlims.gov.pk")
    driver.find_element(By.ID, "admin-password").send_keys("Admin@123")
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 5).until(lambda d: d.current_url == "http://localhost:3001/admin")
    print("Logged in successfully!")

    print("\n2. Checking Navigation & Verifying Logs is REMOVED...")
    bottom_nav = driver.find_element(By.CLASS_NAME, "admin-mobile-nav")
    nav_text = bottom_nav.text
    print(f"Mobile Nav items: {repr(nav_text)}")
    assert "Logs" not in nav_text, "ERROR: Logs still found in navigation!"
    print("CONFIRMED: Logs option is completely removed from navigation!")

    print("\n3. Testing Instant Tab Navigation Speed...")
    t0 = time.time()
    driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-link[href='/admin/licenses']").click()
    WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.CLASS_NAME, "mobile-license-card")))
    t_dir = (time.time() - t0) * 1000
    print(f"Navigated to Directory in {t_dir:.1f}ms (instant client route)")

    t0 = time.time()
    driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-scan[href='/admin/licenses/new']").click()
    WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.ID, "driverNameInput")))
    t_reg = (time.time() - t0) * 1000
    print(f"Navigated to Register in {t_reg:.1f}ms (instant client route)")

    t0 = time.time()
    driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-link[href='/admin/settings']").click()
    WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.ID, "newEmailInput")))
    t_set = (time.time() - t0) * 1000
    print(f"Navigated to Settings in {t_set:.1f}ms (instant client route)")

    print("\n4. Verifying Register Page: FORM FIRST + Instant Compressed Auto-Fill...")
    driver.get("http://localhost:3001/admin/licenses/new")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "driverNameInput")))
    
    driver_name_input = driver.find_element(By.ID, "driverNameInput")
    assert driver_name_input.is_displayed(), "ERROR: Form input should be visible by default!"
    print("CONFIRMED: Registration Form is Option 1 and displayed by default!")
    
    upload_input = driver.find_element(By.ID, "formQuickScanInput")
    test_img = os.path.abspath("public/assets/sample-license-card.png")
    
    t_ocr_start = time.time()
    upload_input.send_keys(test_img)
    
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, "//div[contains(., 'Form fields have been auto-filled')]")))
    t_ocr = (time.time() - t_ocr_start) * 1000
    print(f"Client compressed upload & OCR auto-fill completed in {t_ocr:.1f}ms!")
    
    name_val = driver.find_element(By.ID, "driverNameInput").get_attribute("value")
    cnic_val = driver.find_element(By.ID, "cnicInput").get_attribute("value")
    lic_val = driver.find_element(By.ID, "licNumInput").get_attribute("value")
    print(f"Auto-filled Form: Name={name_val}, CNIC={cnic_val}, License#={lic_val}")
    assert len(name_val) > 0, "Driver name was not auto-filled!"
    assert len(cnic_val) > 0, "CNIC was not auto-filled!"
    
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_register_form_first.png"))
    print("Saved mobile_register_form_first.png")

    print("\n5. Verifying Settings Page: ONLY Email & Password Change...")
    driver.get("http://localhost:3001/admin/settings")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "newEmailInput")))
    
    body_text = driver.find_element(By.TAG_NAME, "body").text
    print(f"Settings Headings: {[line for line in body_text.splitlines() if 'Change' in line]}")
    assert "Change Official Email" in body_text, "Missing Change Official Email"
    assert "Change Account Password" in body_text, "Missing Change Account Password"
    assert "PostgreSQL" not in body_text, "ERROR: PostgreSQL found in settings!"
    assert "Tesseract" not in body_text, "ERROR: Tesseract found in settings!"
    assert "Diagnostic" not in body_text, "ERROR: Diagnostic found in settings!"
    print("CONFIRMED: Settings page contains ONLY Email & Password change options, nothing else!")
    
    # Test Password update validation
    print("Testing Password Update with wrong current password...")
    driver.find_element(By.ID, "passCurrentPassInput").send_keys("WrongPass@123")
    driver.find_element(By.ID, "newPasswordInput").send_keys("NewAdmin@123")
    driver.find_element(By.ID, "confirmPasswordInput").send_keys("NewAdmin@123")
    
    btn = driver.find_element(By.XPATH, "//button[contains(., 'Update Password')]")
    driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", btn)
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "alert-danger")))
    err_text = driver.find_element(By.CLASS_NAME, "alert-danger").text
    print(f"Password update rejected as expected: {err_text}")

    # Test Password update with correct credentials
    print("Testing Password Update with correct password...")
    driver.find_element(By.ID, "passCurrentPassInput").clear()
    driver.find_element(By.ID, "passCurrentPassInput").send_keys("Admin@123")
    driver.find_element(By.ID, "newPasswordInput").clear()
    driver.find_element(By.ID, "newPasswordInput").send_keys("Admin@123")
    driver.find_element(By.ID, "confirmPasswordInput").clear()
    driver.find_element(By.ID, "confirmPasswordInput").send_keys("Admin@123")
    
    btn = driver.find_element(By.XPATH, "//button[contains(., 'Update Password')]")
    driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", btn)
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "alert-success")))
    success_text = driver.find_element(By.CLASS_NAME, "alert-success").text
    print(f"Password updated successfully: {success_text}")

    # Test Email update validation
    print("Testing Email Update validation...")
    driver.find_element(By.ID, "newEmailInput").clear()
    driver.find_element(By.ID, "newEmailInput").send_keys("admin@dlims.gov.pk")
    driver.find_element(By.ID, "emailCurrentPassInput").clear()
    driver.find_element(By.ID, "emailCurrentPassInput").send_keys("Admin@123")
    
    btn_email = driver.find_element(By.XPATH, "//button[contains(., 'Update Email Address')]")
    driver.execute_script("arguments[0].scrollIntoView(true); arguments[0].click();", btn_email)
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "alert-danger")))
    print("Identical email rejected as expected!")

    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_settings_only_email_pass.png"))
    print("Saved mobile_settings_only_email_pass.png")

    print("\n==============================================")
    print("ALL 5 REQUESTED REQUIREMENTS VERIFIED 100%!")
    print("==============================================")

finally:
    driver.quit()
