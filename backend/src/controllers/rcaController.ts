import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';

export const getRcaTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const problems = await prisma.failureProblem.findMany({
      where: { is_active: true },
      include: {
        causes: {
          where: { is_active: true },
          include: {
            remedies: {
              where: { is_active: true }
            }
          }
        }
      }
    });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching RCA tree' });
  }
};

export const getProblems = async (req: Request, res: Response): Promise<void> => {
  try {
    const problems = await prisma.failureProblem.findMany({
      include: {
        _count: {
          select: { causes: true }
        }
      }
    });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching problems' });
  }
};

export const createProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const problem = await prisma.failureProblem.create({ data: { name } });
    emitRefresh('refresh_rca');
    res.status(201).json(problem);
  } catch (error) {
    res.status(500).json({ error: 'Error creating problem' });
  }
};

export const updateProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;
    const problem = await prisma.failureProblem.update({
      where: { id },
      data: { name, is_active }
    });
    emitRefresh('refresh_rca');
    res.json(problem);
  } catch (error) {
    res.status(500).json({ error: 'Error updating problem' });
  }
};

export const getCauses = async (req: Request, res: Response): Promise<void> => {
  try {
    const problemId = req.params.problemId as string;
    const causes = await prisma.failureCause.findMany({ 
      where: { problem_id: problemId },
      include: {
        _count: {
          select: { remedies: true }
        }
      }
    });
    res.json(causes);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching causes' });
  }
};

export const createCause = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, problem_id } = req.body;
    const cause = await prisma.failureCause.create({ data: { name, problem_id } });
    emitRefresh('refresh_rca');
    res.status(201).json(cause);
  } catch (error) {
    res.status(500).json({ error: 'Error creating cause' });
  }
};

export const updateCause = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;
    const cause = await prisma.failureCause.update({
      where: { id },
      data: { name, is_active }
    });
    emitRefresh('refresh_rca');
    res.json(cause);
  } catch (error) {
    res.status(500).json({ error: 'Error updating cause' });
  }
};

export const getRemedies = async (req: Request, res: Response): Promise<void> => {
  try {
    const causeId = req.params.causeId as string;
    const remedies = await prisma.failureRemedy.findMany({ where: { cause_id: causeId } });
    res.json(remedies);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching remedies' });
  }
};

export const createRemedy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, cause_id } = req.body;
    const remedy = await prisma.failureRemedy.create({ data: { name, cause_id } });
    emitRefresh('refresh_rca');
    res.status(201).json(remedy);
  } catch (error) {
    res.status(500).json({ error: 'Error creating remedy' });
  }
};

export const updateRemedy = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;
    const remedy = await prisma.failureRemedy.update({
      where: { id },
      data: { name, is_active }
    });
    emitRefresh('refresh_rca');
    res.json(remedy);
  } catch (error) {
    res.status(500).json({ error: 'Error updating remedy' });
  }
};
