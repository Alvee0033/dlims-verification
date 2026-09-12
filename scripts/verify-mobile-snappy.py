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
    print("1. Testing Mobile Login...")
    driver.get("http://localhost:3001/admin/login")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "admin-email")))
    
    email_el = driver.find_element(By.ID, "admin-email")
    pass_el = driver.find_element(By.ID, "admin-password")
    
    email_el.clear()
    email_el.send_keys("admin@dlims.gov.pk")
    pass_el.clear()
    pass_el.send_keys("Admin@123")
    
    submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    t0 = time.time()
    submit_btn.click()
    
    WebDriverWait(driver, 5).until(lambda d: d.current_url == "http://localhost:3001/admin")
    print(f"Login success in {(time.time()-t0)*1000:.1f}ms! Current URL: {driver.current_url}")
    time.sleep(1)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_admin_dashboard.png"))
    print("Saved mobile_admin_dashboard.png")

    print("2. Testing Mobile Directory...")
    dir_nav = driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-link[href='/admin/licenses']")
    dir_nav.click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "mobile-license-card")))
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_admin_directory.png"))
    print("Saved mobile_admin_directory.png")

    print("3. Testing Mobile ID Scanner & Real Tesseract OCR...")
    scan_nav = driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-scan")
    scan_nav.click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "idCardCameraInput")))
    
    # Upload real license card image
    upload_input = driver.find_element(By.ID, "idCardCameraInput")
    test_img = os.path.abspath("public/assets/sample-license-card.png")
    assert os.path.exists(test_img), f"Test image does not exist: {test_img}"
    
    t_ocr_start = time.time()
    upload_input.send_keys(test_img)
    
    # Wait for OCR results (Apply button appears)
    WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Apply Extracted Data')]")))
    t_ocr = (time.time() - t_ocr_start) * 1000
    print(f"OCR finished in {t_ocr:.1f}ms!")
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_admin_scanner.png"))
    print("Saved mobile_admin_scanner.png")

    print("4. Testing Mobile Logs...")
    logs_nav = driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-link[href='/admin/logs']")
    logs_nav.click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "mobile-license-card")))
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_admin_logs.png"))
    print("Saved mobile_admin_logs.png")

    print("5. Testing Mobile Settings & Instant Diagnostics...")
    settings_nav = driver.find_element(By.CSS_SELECTOR, "a.mobile-nav-link[href='/admin/settings']")
    settings_nav.click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Run Instant System Check')]")))
    diag_btn = driver.find_element(By.XPATH, "//button[contains(., 'Run Instant System Check')]")
    diag_btn.click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CLASS_NAME, "alert-success")))
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_admin_settings.png"))
    print("Saved mobile_admin_settings.png")

    print("6. Testing Mobile Public Citizen Verification Portal (390px)...")
    driver.get("http://localhost:3001/")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "search_value")))
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_public_home.png"))
    print("Saved mobile_public_home.png")

    input_el = driver.find_element(By.ID, "search_value")
    input_el.clear()
    input_el.send_keys("33105-8011903-7")
    
    verify_btn = driver.find_element(By.CSS_SELECTOR, "button.verify-btn")
    t_v0 = time.time()
    verify_btn.click()
    
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".verification-result")))
    print(f"Public verification result returned in {(time.time()-t_v0)*1000:.1f}ms!")
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "mobile_public_verified.png"))
    print("Saved mobile_public_verified.png")

    print("7. Testing Desktop Public Portal (1280x800)...")
    driver.set_window_size(1280, 800)
    driver.get("http://localhost:3001/")
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "search_value")))
    input_el = driver.find_element(By.ID, "search_value")
    input_el.clear()
    input_el.send_keys("33105-8011903-7")
    driver.find_element(By.CSS_SELECTOR, "button.verify-btn").click()
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".verification-result")))
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(ARTIFACT_DIR, "desktop_public_verified.png"))
    print("Saved desktop_public_verified.png")

    print("\n==========================================")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==========================================")

finally:
    driver.quit()
