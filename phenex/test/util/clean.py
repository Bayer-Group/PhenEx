import shutil
import os


def clean():
    try:
        path_artificats = os.path.join(__file__, "../phenotypes/artifacts")
        shutil.rmtree(path_artificats)
    except:
        pass


if __name__ == "__main__":
    clean()
