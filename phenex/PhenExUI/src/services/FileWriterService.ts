export class FileWriterService {
  private static fileHandle: FileSystemFileHandle | null = null;

  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      if (!this.fileHandle) {
        // Request permission to create/write file
        this.fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filePath,
        });
      }

      // Create a FileSystemWritableFileStream to write to
      const writable = await this.fileHandle!.createWritable();

      // Write the contents
      await writable.write(content);

      // Close the file and write the contents to disk
      await writable.close();
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  }
}
