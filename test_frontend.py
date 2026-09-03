import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def test_player(driver, url, name):
    print(f"\n--- Testing {name} ---")
    driver.get(url)
    
    # Wait for the page to load
    time.sleep(3)
    
    # Check for console logs
    logs = driver.get_log('browser')
    errors = [log for log in logs if log['level'] == 'SEVERE']
    
    if errors:
        print(f"[{name}] Browser Console Errors Found:")
        for e in errors:
            print(e['message'])
    else:
        print(f"[{name}] No console errors!")
        
    # Take a screenshot
    driver.save_screenshot(f"{name}_dashboard.png")
    print(f"[{name}] Saved screenshot to {name}_dashboard.png")

def main():
    options = uc.ChromeOptions()
    options.add_argument('--headless')
    
    driver = uc.Chrome(options=options)
    
    try:
        # Outfield player: Paolo Guerrero
        test_player(driver, 'http://localhost:5174/player/338', 'Paolo_Guerrero')
        
    finally:
        driver.quit()

if __name__ == '__main__':
    main()
