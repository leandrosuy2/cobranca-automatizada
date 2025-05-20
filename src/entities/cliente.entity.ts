import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Contrato } from './contrato.entity';

@Entity('clientes', { orderBy: { id: 'ASC' } })
export class Cliente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nome: string;

  @Column()
  whatsapp: string;

  @Column()
  cpf: string;

  @Column()
  email: string;

  @OneToMany(() => Contrato, contrato => contrato.cliente)
  contratos: Contrato[];
} 