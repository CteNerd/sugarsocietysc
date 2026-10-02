export interface IContactQueue {
  enqueue(submissionId: string): Promise<void>;
}
