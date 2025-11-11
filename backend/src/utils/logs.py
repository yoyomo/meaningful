RED = "\033[31m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
GRAY = "\033[90m"
GREEN = "\033[32m"
RESET = "\033[0m"

def log_error(colored_message: str, message: str = ""):
    print(f"{RED}{colored_message}:{RESET} {message}")

def log_warning(colored_message: str, message: str = ""):
    print(f"{YELLOW}{colored_message}:{RESET} {message}")

def log_info(colored_message: str, message: str = ""):
    print(f"{BLUE}{colored_message}:{RESET} {message}")

def log_debug(colored_message: str, message: str = ""):
    print(f"{GRAY}{colored_message}:{RESET} {message}")

def log_success(colored_message: str, message: str = ""):
    print(f"{GREEN}{colored_message}:{RESET} {message}")