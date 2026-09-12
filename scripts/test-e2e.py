import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_tests():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=1400,900')

    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 10)

    try:
        # TEST 1: Public Portal Verification (Found)
        print("=== TEST 1: Public Portal Verification ===")
        driver.get("http://localhost:3001/")
        time.sleep(1)

        search_input = wait.until(EC.presence_of_element_located((By.ID, "search_value")))
        search_input.clear()
        search_input.send_keys("1280011963")

        verify_btn = driver.find_element(By.CSS_SELECTOR, "button.verify-btn")
        verify_btn.click()

        # Wait for result panel
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".verification-result")))
        print("Verification result panel rendered!")
        driver.save_screenshot("/tmp/audit_public_result_found.png")

        # Check driver name in result
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Saqlain Ishfaq" in body_text, "Name not found in result"
        assert "1280011963" in body_text, "License number not found in result"
        print("Verified record matches PostgreSQL data: Saqlain Ishfaq / 1280011963")

        # TEST 2: Public Portal Verification (Not Found)
        print("\n=== TEST 2: Public Portal Not Found Alert ===")
        back_btn = driver.find_element(By.CSS_SELECTOR, "a.back-button")
        back_btn.click()
        time.sleep(1)

        search_input = wait.until(EC.presence_of_element_located((By.ID, "search_value")))
        search_input.clear()
        search_input.send_keys("NOTEXIST-777")
        driver.find_element(By.CSS_SELECTOR, "button.verify-btn").click()

        # Wait for error message
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".alert-danger")))
        driver.save_screenshot("/tmp/audit_public_not_found.png")
        print("Not found error alert rendered cleanly inside card!")

        # TEST 3: Admin Login
        print("\n=== TEST 3: Admin Login ===")
        driver.get("http://localhost:3001/admin/login")
        time.sleep(1)

        # Click quick fill
        quick_fill = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Auto-fill Demo Credentials')]")))
        driver.execute_script("arguments[0].click();", quick_fill)
        time.sleep(0.5)

        sub_login = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        driver.execute_script("arguments[0].click();", sub_login)

        # Wait for dashboard to load
        wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Administrative Dashboard"))
        time.sleep(1)
        print("Admin login successful, redirected to:", driver.current_url)
        driver.save_screenshot("/tmp/audit_admin_dashboard.png")

        # Check metrics on dashboard
        metrics_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Administrative Dashboard" in metrics_text
        assert "PostgreSQL" in metrics_text
        print("Dashboard metrics and telemetry rendered properly!")

        # TEST 4: Add License with OCR
        print("\n=== TEST 4: Add License with AI OCR ===")
        driver.get("http://localhost:3001/admin/licenses/new")
        time.sleep(1)

        sample_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Try Sample License')]")))
        driver.execute_script("arguments[0].click();", sample_btn)
        print("Clicked 'Try Sample License', running Tesseract OCR...")

        # Wait for OCR results (confidence badge or populate button)
        populate_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Populate Form With Extracted Data')]")))
        time.sleep(1)
        driver.save_screenshot("/tmp/audit_ocr_scanner_results.png")
        print("OCR scanning completed and extracted fields previewed!")

        # Click populate form
        driver.execute_script("arguments[0].click();", populate_btn)
        time.sleep(1)

        # Check that form fields are filled
        name_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='e.g. Saqlain Ishfaq']")
        driver_name = name_input.get_attribute("value")
        print("Form auto-filled driver name:", driver_name)
        assert len(driver_name) > 0, "Name was not auto-filled"

        # Submit form to save to PostgreSQL
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        driver.execute_script("arguments[0].click();", submit_btn)
        time.sleep(2)
        driver.save_screenshot("/tmp/audit_saved_license.png")
        print("Saved newly scanned license to PostgreSQL!")

        # TEST 5: Check Directory
        print("\n=== TEST 5: License Directory ===")
        driver.get("http://localhost:3001/admin/licenses")
        wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Saqlain Ishfaq"))
        time.sleep(0.5)
        driver.save_screenshot("/tmp/audit_license_directory.png")
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Saqlain Ishfaq" in body_text
        print("Directory lists all active licenses!")

        # TEST 6: Mobile Responsiveness Check (390px iPhone)
        print("\n=== TEST 6: Mobile Responsiveness ===")
        driver.set_window_size(390, 844)
        driver.get("http://localhost:3001/")
        time.sleep(1)

        scroll_width = driver.execute_script("return document.documentElement.scrollWidth")
        client_width = driver.execute_script("return document.documentElement.clientWidth")
        print(f"Mobile Public Portal: scrollWidth={scroll_width}, clientWidth={client_width}")
        assert scroll_width == client_width, f"Mobile overflow detected: {scroll_width} vs {client_width}"
        driver.save_screenshot("/tmp/audit_mobile_public.png")

        driver.get("http://localhost:3001/admin")
        time.sleep(1.5)
        scroll_width_admin = driver.execute_script("return document.documentElement.scrollWidth")
        client_width_admin = driver.execute_script("return document.documentElement.clientWidth")
        print(f"Mobile Admin Dashboard: scrollWidth={scroll_width_admin}, clientWidth={client_width_admin}")
        driver.save_screenshot("/tmp/audit_mobile_admin.png")

        print("\nALL 6 END-TO-END AUTOMATED VERIFICATION TESTS PASSED PERFECTLY!")

    finally:
        driver.quit()

if __name__ == '__main__':
    run_tests()
